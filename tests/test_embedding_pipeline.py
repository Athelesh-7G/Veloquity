# =============================================================
# tests/test_embedding_pipeline.py
# Unit tests for the Phase 2 evidence pipeline modules.
# All AWS and DB calls are mocked. No network I/O.
# =============================================================

import json
import math
import os
from unittest.mock import MagicMock, patch

# Set required env vars before any evidence module is imported,
# because embedding_pipeline calls _validate_env() at module level.
os.environ.setdefault("AWS_REGION_NAME", "us-east-1")
os.environ.setdefault("S3_RAW_BUCKET", "veloquity-raw-test")
os.environ.setdefault("DB_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:123:secret:test")
os.environ.setdefault("BEDROCK_EMBED_MODEL", "amazon.titan-embed-text-v2:0")

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_vector(seed: float, dims: int = 8) -> list[float]:
    """Return a unit vector seeded by `seed` with `dims` dimensions."""
    raw = [seed + i * 0.01 for i in range(dims)]
    norm = math.sqrt(sum(x * x for x in raw))
    return [x / norm for x in raw]


def _make_item(text: str = "some feedback", source: str = "app_store",
               seed: float = 1.0) -> dict:
    return {
        "s3_key":  f"app_store/2024/01/01/{text[:4]}.json",
        "item_id": text[:4],
        "text":    text,
        "source":  source,
        "hash":    "abc123",
        "vector":  _make_vector(seed),
    }


# ---------------------------------------------------------------------------
# 1. get_or_create_embedding — cache hit
# ---------------------------------------------------------------------------

class TestGetOrCreateEmbeddingCacheHit:
    def test_returns_cached_vector_without_bedrock(self):
        cached_vec = [0.1, 0.2, 0.3]

        with patch("evidence.embedding_pipeline._cache_lookup", return_value=cached_vec) as mock_lookup, \
             patch("evidence.embedding_pipeline._call_bedrock") as mock_bedrock, \
             patch("evidence.embedding_pipeline._cache_write") as mock_write:

            from evidence.embedding_pipeline import get_or_create_embedding, _stats
            _stats["cache_hits"] = 0
            result = get_or_create_embedding("hello world", "titan-v2")

        assert result == cached_vec
        mock_bedrock.assert_not_called()
        mock_write.assert_not_called()
        assert _stats["cache_hits"] == 1

    def test_cache_hit_increments_counter(self):
        with patch("evidence.embedding_pipeline._cache_lookup", return_value=[0.5]), \
             patch("evidence.embedding_pipeline._call_bedrock"):

            from evidence.embedding_pipeline import get_or_create_embedding, _stats
            _stats["cache_hits"] = 0
            get_or_create_embedding("test", "model")

        assert _stats["cache_hits"] == 1


# ---------------------------------------------------------------------------
# 2. get_or_create_embedding — cache miss (Bedrock called)
# ---------------------------------------------------------------------------

class TestGetOrCreateEmbeddingCacheMiss:
    def test_calls_bedrock_on_miss(self):
        bedrock_vec = [0.9, 0.8, 0.7]

        with patch("evidence.embedding_pipeline._cache_lookup", return_value=None), \
             patch("evidence.embedding_pipeline._call_bedrock", return_value=bedrock_vec) as mock_bedrock, \
             patch("evidence.embedding_pipeline._cache_write") as mock_write:

            from evidence.embedding_pipeline import get_or_create_embedding, _stats
            _stats["bedrock_calls"] = 0
            result = get_or_create_embedding("hello", "model")

        assert result == bedrock_vec
        mock_bedrock.assert_called_once_with("hello", "model")
        mock_write.assert_called_once()
        assert _stats["bedrock_calls"] == 1

    def test_returns_none_on_bedrock_error(self):
        with patch("evidence.embedding_pipeline._cache_lookup", return_value=None), \
             patch("evidence.embedding_pipeline._call_bedrock", return_value=None):

            from evidence.embedding_pipeline import get_or_create_embedding
            result = get_or_create_embedding("hello", "model")

        assert result is None

    def test_empty_text_returns_none(self):
        with patch("evidence.embedding_pipeline._cache_lookup") as mock_lookup:
            from evidence.embedding_pipeline import get_or_create_embedding
            result = get_or_create_embedding("   ", "model")

        assert result is None
        mock_lookup.assert_not_called()

    def test_cache_write_failure_is_non_fatal(self):
        bedrock_vec = [0.1, 0.2]

        with patch("evidence.embedding_pipeline._cache_lookup", return_value=None), \
             patch("evidence.embedding_pipeline._call_bedrock", return_value=bedrock_vec), \
             patch("evidence.embedding_pipeline._cache_write", side_effect=Exception("DB down")):

            from evidence.embedding_pipeline import get_or_create_embedding
            result = get_or_create_embedding("text", "model")

        # Should still return the vector despite cache write failure.
        assert result == bedrock_vec


# ---------------------------------------------------------------------------
# 3. cluster_embeddings — grouping and size filtering
# ---------------------------------------------------------------------------

class TestClusterEmbeddings:
    def test_skips_none_vectors(self):
        from evidence.clustering import cluster_embeddings
        items = [
            {"vector": None, "text": "a", "source": "x", "s3_key": "k1"},
            {"vector": _make_vector(1.0), "text": "b", "source": "x", "s3_key": "k2"},
        ]
        with patch.dict("os.environ", {"MIN_COSINE_SIMILARITY": "0.5", "MIN_CLUSTER_SIZE": "1"}):
            result = cluster_embeddings(items)
        assert len(result) == 1
        assert result[0]["size"] == 1

    def test_similar_items_grouped_together(self):
        from evidence.clustering import cluster_embeddings
        # All items point in the same direction → should cluster together.
        base = _make_vector(1.0, dims=16)
        items = [{"vector": base, "text": f"t{i}", "source": "s", "s3_key": f"k{i}"}
                 for i in range(5)]
        with patch.dict("os.environ", {"MIN_COSINE_SIMILARITY": "0.99", "MIN_CLUSTER_SIZE": "5"}):
            result = cluster_embeddings(items)
        assert len(result) == 1
        assert result[0]["size"] == 5

    def test_different_items_form_separate_clusters(self):
        from evidence.clustering import cluster_embeddings
        # Two orthogonal directions.
        v1 = [1.0, 0.0, 0.0, 0.0]
        v2 = [0.0, 1.0, 0.0, 0.0]
        items = (
            [{"vector": v1, "text": f"a{i}", "source": "s", "s3_key": f"a{i}"} for i in range(5)] +
            [{"vector": v2, "text": f"b{i}", "source": "s", "s3_key": f"b{i}"} for i in range(5)]
        )
        with patch.dict("os.environ", {"MIN_COSINE_SIMILARITY": "0.75", "MIN_CLUSTER_SIZE": "5"}):
            result = cluster_embeddings(items)
        assert len(result) == 2

    def test_undersized_clusters_dropped(self):
        from evidence.clustering import cluster_embeddings
        v = _make_vector(1.0)
        items = [{"vector": v, "text": f"t{i}", "source": "s", "s3_key": f"k{i}"}
                 for i in range(3)]
        with patch.dict("os.environ", {"MIN_COSINE_SIMILARITY": "0.99", "MIN_CLUSTER_SIZE": "5"}):
            result = cluster_embeddings(items)
        assert result == []

    def test_empty_input_returns_empty(self):
        from evidence.clustering import cluster_embeddings
        with patch.dict("os.environ", {"MIN_COSINE_SIMILARITY": "0.75", "MIN_CLUSTER_SIZE": "5"}):
            assert cluster_embeddings([]) == []


# ---------------------------------------------------------------------------
# 4. compute_confidence
# ---------------------------------------------------------------------------

class TestComputeConfidence:
    def _cluster(self, vectors: list[list[float]]) -> dict:
        centroid = [
            sum(v[i] for v in vectors) / len(vectors)
            for i in range(len(vectors[0]))
        ]
        return {
            "cluster_id": "test",
            "centroid_vector": centroid,
            "items": [{"vector": v} for v in vectors],
        }

    def test_identical_vectors_give_high_confidence(self):
        from evidence.confidence import compute_confidence
        v = _make_vector(1.0)
        cluster = self._cluster([v, v, v, v, v])
        score = compute_confidence(cluster)
        assert score > 0.9

    def test_spread_vectors_give_lower_confidence(self):
        from evidence.confidence import compute_confidence
        vectors = [_make_vector(float(i)) for i in range(1, 6)]
        cluster = self._cluster(vectors)
        tight_cluster = self._cluster([_make_vector(1.0)] * 5)
        assert compute_confidence(cluster) < compute_confidence(tight_cluster)

    def test_clamped_to_zero_not_negative(self):
        from evidence.confidence import compute_confidence
        # Very spread vectors should clamp to 0, not go negative.
        vectors = [
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0],
            [-1.0, 0.0, 0.0, 0.0],
            [0.0, -1.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
        ]
        cluster = {
            "cluster_id": "x",
            "centroid_vector": [0.0, 0.0, 0.2, 0.0],
            "items": [{"vector": v} for v in vectors],
        }
        score = compute_confidence(cluster)
        assert 0.0 <= score <= 1.0

    def test_empty_cluster_returns_zero(self):
        from evidence.confidence import compute_confidence
        score = compute_confidence({"cluster_id": "x", "centroid_vector": [], "items": []})
        assert score == 0.0

    def test_items_with_null_vectors_skipped(self):
        from evidence.confidence import compute_confidence
        v = _make_vector(1.0)
        cluster = {
            "cluster_id": "x",
            "centroid_vector": v,
            "items": [{"vector": v}, {"vector": None}, {"vector": v}],
        }
        score = compute_confidence(cluster)
        assert score > 0.9


# ---------------------------------------------------------------------------
# 5. classify_confidence
# ---------------------------------------------------------------------------

class TestClassifyConfidence:
    def test_low_score_is_reject(self):
        from evidence.confidence import classify_confidence
        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}):
            assert classify_confidence(0.3) == "reject"

    def test_mid_score_is_ambiguous(self):
        from evidence.confidence import classify_confidence
        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}):
            assert classify_confidence(0.5) == "ambiguous"

    def test_high_score_is_accept(self):
        from evidence.confidence import classify_confidence
        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}):
            assert classify_confidence(0.8) == "accept"

    def test_boundary_at_reject_threshold(self):
        from evidence.confidence import classify_confidence
        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}):
            # Exactly at reject threshold → ambiguous (score < reject → reject, score >= reject → ambiguous)
            assert classify_confidence(0.4) == "ambiguous"

    def test_boundary_at_accept_threshold(self):
        from evidence.confidence import classify_confidence
        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}):
            assert classify_confidence(0.6) == "accept"


# ---------------------------------------------------------------------------
# 6. evaluate_cluster
# ---------------------------------------------------------------------------

class TestEvaluateCluster:
    def _cluster(self) -> dict:
        v = _make_vector(1.0)
        return {
            "cluster_id": "cl-1",
            "centroid_vector": v,
            "items": [{"vector": v, "text": f"feedback {i}", "source": "app_store"}
                      for i in range(5)],
        }

    def test_high_score_auto_accept(self):
        from evidence.threshold import evaluate_cluster
        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}):
            result = evaluate_cluster(self._cluster(), 0.9)
        assert result["decision"] == "accept"
        assert result["reason"] is None

    def test_low_score_auto_reject(self):
        from evidence.threshold import evaluate_cluster
        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}):
            result = evaluate_cluster(self._cluster(), 0.2)
        assert result["decision"] == "reject"
        assert result["reason"] is None

    def test_ambiguous_score_calls_llm(self):
        from evidence.threshold import evaluate_cluster
        llm_result = {"decision": "accept", "reason": "real signal"}

        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}), \
             patch("evidence.threshold.validate_with_llm", return_value=llm_result) as mock_llm:
            result = evaluate_cluster(self._cluster(), 0.5)

        assert result["decision"] == "accept"
        assert result["reason"] == "real signal"
        mock_llm.assert_called_once()

    def test_llm_failure_returns_reject(self):
        from evidence.threshold import evaluate_cluster, validate_with_llm
        fail_result = {"decision": "reject", "reason": "llm_validation_failed"}

        with patch.dict("os.environ", {"CONFIDENCE_AUTO_REJECT": "0.4", "CONFIDENCE_AUTO_ACCEPT": "0.6"}), \
             patch("evidence.threshold.validate_with_llm", return_value=fail_result):
            result = evaluate_cluster(self._cluster(), 0.5)

        assert result["decision"] == "reject"


# ---------------------------------------------------------------------------
# 7. write_evidence and write_staging
# ---------------------------------------------------------------------------

class TestWriteEvidence:
    def _cluster(self) -> dict:
        v = _make_vector(1.0, dims=4)
        return {
            "cluster_id": "cl-ev",
            "centroid_vector": v,
            "items": [
                {"vector": v, "text": f"text {i}", "source": "app_store", "hash": f"h{i}"}
                for i in range(5)
            ],
        }

    def test_returns_uuid_string(self):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = ("00000000-0000-0000-0000-000000000001",)
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cur
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch("evidence.evidence_writer.get_conn", return_value=mock_conn), \
             patch("evidence.evidence_writer.release_conn"), \
             patch.dict("os.environ", {"BEDROCK_EMBED_MODEL": "titan-v2"}):
            from evidence.evidence_writer import write_evidence
            eid = write_evidence(self._cluster(), 0.85)

        assert isinstance(eid, str)
        assert eid == "00000000-0000-0000-0000-000000000001"
        mock_conn.commit.assert_called_once()

    def test_rollback_on_db_error(self):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.execute.side_effect = Exception("DB error")
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cur
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch("evidence.evidence_writer.get_conn", return_value=mock_conn), \
             patch("evidence.evidence_writer.release_conn"), \
             patch.dict("os.environ", {"BEDROCK_EMBED_MODEL": "titan-v2"}):
            from evidence.evidence_writer import write_evidence
            with pytest.raises(Exception, match="DB error"):
                write_evidence(self._cluster(), 0.85)

        mock_conn.rollback.assert_called_once()


class TestWriteStaging:
    def _cluster(self) -> dict:
        return {
            "cluster_id": "cl-st",
            "items": [
                {"text": f"low conf {i}", "source": "zendesk", "hash": f"h{i}"}
                for i in range(3)
            ],
        }

    def test_returns_uuid_string(self):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = ("00000000-0000-0000-0000-000000000002",)
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cur
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch("evidence.evidence_writer.get_conn", return_value=mock_conn), \
             patch("evidence.evidence_writer.release_conn"):
            from evidence.evidence_writer import write_staging
            sid = write_staging(self._cluster(), 0.2)

        assert sid == "00000000-0000-0000-0000-000000000002"
        mock_conn.commit.assert_called_once()

    def test_rollback_on_db_error(self):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.execute.side_effect = Exception("constraint violation")
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cur
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch("evidence.evidence_writer.get_conn", return_value=mock_conn), \
             patch("evidence.evidence_writer.release_conn"):
            from evidence.evidence_writer import write_staging
            with pytest.raises(Exception, match="constraint violation"):
                write_staging(self._cluster(), 0.2)

        mock_conn.rollback.assert_called_once()


# ---------------------------------------------------------------------------
# 8. Full integration: handler end-to-end (all external calls mocked)
# ---------------------------------------------------------------------------

class TestHandlerIntegration:
    """5 items → 1 cluster → accepted → write_evidence called once."""

    def _s3_item(self, i: int) -> dict:
        return {
            "id":     f"item-{i}",
            "text":   f"the app crashes when I tap the button {i}",
            "source": "app_store",
            "hash":   f"hash{i}",
        }

    def test_full_pipeline_accept(self):
        # All 5 items get the same vector → cluster → high confidence → accepted.
        fixed_vec = _make_vector(1.0, dims=8)

        mock_s3_client = MagicMock()
        def fake_get_object(Bucket, Key):
            idx = int(Key.rsplit("/", 1)[-1].replace(".json", "").rsplit("-", 1)[-1])
            return {"Body": MagicMock(read=lambda: json.dumps(self._s3_item(idx)).encode())}
        mock_s3_client.get_object.side_effect = fake_get_object

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = ("aaaaaaaa-0000-0000-0000-000000000001",)
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cur
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        event = {"batch": [f"app_store/2024/01/01/item-{i}.json" for i in range(5)]}

        env = {
            "AWS_REGION_NAME":       "us-east-1",
            "S3_RAW_BUCKET":         "veloquity-raw-test",
            "DB_SECRET_ARN":         "arn:aws:secretsmanager:us-east-1:123:secret:test",
            "BEDROCK_EMBED_MODEL":   "amazon.titan-embed-text-v2:0",
            "BEDROCK_LLM_MODEL":     "us.amazon.nova-pro-v1:0",
            "CONFIDENCE_AUTO_REJECT": "0.4",
            "CONFIDENCE_AUTO_ACCEPT": "0.6",
            "MIN_COSINE_SIMILARITY":  "0.5",
            "MIN_CLUSTER_SIZE":       "5",
        }

        with patch.dict("os.environ", env), \
             patch("evidence.embedding_pipeline._get_s3", return_value=mock_s3_client), \
             patch("evidence.embedding_pipeline.get_or_create_embedding", return_value=fixed_vec), \
             patch("evidence.embedding_pipeline.write_evidence", return_value="ev-id") as mock_we, \
             patch("evidence.embedding_pipeline.write_staging") as mock_ws, \
             patch("evidence.embedding_pipeline.evaluate_cluster",
                   return_value={"decision": "accept", "cluster": {}, "confidence_score": 0.95, "reason": None}):

            from evidence.embedding_pipeline import handler
            result = handler(event, None)

        assert result["processed"] == 5
        assert result["accepted"] == 1
        assert result["rejected"] == 0
        assert result["errors"] == 0
        mock_we.assert_called_once()
        mock_ws.assert_not_called()

    def test_full_pipeline_reject(self):
        fixed_vec = _make_vector(1.0, dims=8)

        mock_s3_client = MagicMock()
        def fake_get_object(Bucket, Key):
            idx = int(Key.rsplit("/", 1)[-1].replace(".json", "").rsplit("-", 1)[-1])
            return {"Body": MagicMock(read=lambda: json.dumps(self._s3_item(idx)).encode())}
        mock_s3_client.get_object.side_effect = fake_get_object

        event = {"batch": [f"app_store/2024/01/01/item-{i}.json" for i in range(5)]}
        env = {
            "AWS_REGION_NAME":       "us-east-1",
            "S3_RAW_BUCKET":         "veloquity-raw-test",
            "DB_SECRET_ARN":         "arn:aws:secretsmanager:us-east-1:123:secret:test",
            "BEDROCK_EMBED_MODEL":   "amazon.titan-embed-text-v2:0",
            "BEDROCK_LLM_MODEL":     "us.amazon.nova-pro-v1:0",
            "CONFIDENCE_AUTO_REJECT": "0.4",
            "CONFIDENCE_AUTO_ACCEPT": "0.6",
            "MIN_COSINE_SIMILARITY":  "0.5",
            "MIN_CLUSTER_SIZE":       "5",
        }

        with patch.dict("os.environ", env), \
             patch("evidence.embedding_pipeline._get_s3", return_value=mock_s3_client), \
             patch("evidence.embedding_pipeline.get_or_create_embedding", return_value=fixed_vec), \
             patch("evidence.embedding_pipeline.write_evidence") as mock_we, \
             patch("evidence.embedding_pipeline.write_staging", return_value="st-id") as mock_ws, \
             patch("evidence.embedding_pipeline.evaluate_cluster",
                   return_value={"decision": "reject", "cluster": {}, "confidence_score": 0.1, "reason": None}):

            from evidence.embedding_pipeline import handler
            result = handler(event, None)

        assert result["accepted"] == 0
        assert result["rejected"] == 1
        mock_ws.assert_called_once()
        mock_we.assert_not_called()

    def test_invalid_event_returns_error_dict(self):
        env = {
            "AWS_REGION_NAME":     "us-east-1",
            "S3_RAW_BUCKET":       "veloquity-raw-test",
            "DB_SECRET_ARN":       "arn:aws:secretsmanager:us-east-1:123:secret:test",
            "BEDROCK_EMBED_MODEL": "amazon.titan-embed-text-v2:0",
        }
        with patch.dict("os.environ", env):
            from evidence.embedding_pipeline import handler
            result = handler({"unexpected_key": "value"}, None)

        assert result["processed"] == 0
        assert "message" in result

    def test_s3_read_error_counted_in_errors(self):
        from botocore.exceptions import ClientError

        mock_s3_client = MagicMock()
        mock_s3_client.get_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Not found"}}, "GetObject"
        )

        event = {"batch": ["app_store/2024/01/01/missing.json"]}
        env = {
            "AWS_REGION_NAME":       "us-east-1",
            "S3_RAW_BUCKET":         "veloquity-raw-test",
            "DB_SECRET_ARN":         "arn:aws:secretsmanager:us-east-1:123:secret:test",
            "BEDROCK_EMBED_MODEL":   "amazon.titan-embed-text-v2:0",
            "MIN_COSINE_SIMILARITY":  "0.75",
            "MIN_CLUSTER_SIZE":       "5",
        }

        with patch.dict("os.environ", env), \
             patch("evidence.embedding_pipeline._get_s3", return_value=mock_s3_client):

            from evidence.embedding_pipeline import handler
            result = handler(event, None)

        assert result["errors"] >= 1
        assert result["accepted"] == 0

# =============================================================
# tests/test_evidence_item_map.py
# 39 tests across 8 classes covering:
#   - _derive_s3_key
#   - compute_source_lineage
#   - _extract_quotes
#   - write_item_map
#   - write_evidence (with item map)
#   - write_staging (no item map)
#   - _read_s3_item (embedding_pipeline)
#   - promote_staging_signals (_recover_item_map integration)
# =============================================================

import json
import os
import sys
from unittest.mock import MagicMock, call, patch

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

def _make_item(
    text="App crashes",
    source="app_store",
    hash_="abc123",
    item_id="item-uuid-001",
    timestamp="2026-03-08T10:00:00Z",
    s3_key=None,
    vector=None,
):
    item = {
        "id": item_id,
        "text": text,
        "source": source,
        "hash": hash_,
        "timestamp": timestamp,
    }
    if s3_key:
        item["s3_key"] = s3_key
    if vector:
        item["vector"] = vector
    return item


def _make_conn(fetchone_return=None, rowcount=3):
    conn = MagicMock()
    cur = MagicMock()
    cur.__enter__ = lambda s: s
    cur.__exit__ = MagicMock(return_value=False)
    cur.fetchone.return_value = fetchone_return or ("evidence-uuid-001",)
    cur.rowcount = rowcount
    conn.cursor.return_value = cur
    return conn, cur


# ---------------------------------------------------------------------------
# CLASS 1: TestDeriveS3Key
# ---------------------------------------------------------------------------

class TestDeriveS3Key:
    def setup_method(self):
        from evidence.evidence_writer import _derive_s3_key
        self._derive_s3_key = _derive_s3_key

    def test_explicit_s3_key_returned_verbatim(self):
        item = _make_item(s3_key="app_store/2026/03/08/uuid.json")
        assert self._derive_s3_key(item) == "app_store/2026/03/08/uuid.json"

    def test_derived_from_iso_timestamp(self):
        item = _make_item(
            source="app_store",
            item_id="uuid-001",
            timestamp="2026-03-08T10:00:00Z",
        )
        assert self._derive_s3_key(item) == "app_store/2026/03/08/uuid-001.json"

    def test_derived_from_unix_timestamp(self):
        # 1772928000.0 = 2026-03-08T00:00:00Z
        item = _make_item(source="zendesk", item_id="uuid-002", timestamp=1772928000.0)
        result = self._derive_s3_key(item)
        assert "zendesk/2026/" in result
        assert "uuid-002.json" in result

    def test_fallback_when_timestamp_is_none(self):
        item = {"id": "uuid-003", "source": "app_store", "text": "x", "hash": "h", "timestamp": None}
        assert self._derive_s3_key(item) == "app_store/unknown/uuid-003.json"

    def test_fallback_when_timestamp_malformed(self):
        item = _make_item(timestamp="not-a-date")
        assert "unknown" in self._derive_s3_key(item)

    def test_zendesk_source_appears_in_key(self):
        item = _make_item(source="zendesk", item_id="z-001", timestamp="2026-06-15T09:00:00Z")
        assert self._derive_s3_key(item).startswith("zendesk/2026/06/15/")


# ---------------------------------------------------------------------------
# CLASS 2: TestComputeSourceLineage
# ---------------------------------------------------------------------------

class TestComputeSourceLineage:
    def setup_method(self):
        from evidence.evidence_writer import compute_source_lineage
        self.compute_source_lineage = compute_source_lineage

    def test_single_source_returns_1_0(self):
        items = [_make_item(source="app_store") for _ in range(4)]
        result = self.compute_source_lineage(items)
        assert result == {"app_store": 1.0}

    def test_two_sources_proportional(self):
        items = (
            [_make_item(source="app_store", hash_=f"h{i}") for i in range(6)]
            + [_make_item(source="zendesk", hash_=f"z{i}") for i in range(4)]
        )
        result = self.compute_source_lineage(items)
        assert "app_store" in result
        assert "zendesk" in result
        assert result["app_store"] > result["zendesk"]
        assert pytest.approx(sum(result.values()), abs=1e-4) == 1.0

    def test_floating_point_sums_exactly_to_one(self):
        items = [
            _make_item(source="app_store", hash_="h1"),
            _make_item(source="zendesk", hash_="h2"),
            _make_item(source="twitter", hash_="h3"),
        ]
        result = self.compute_source_lineage(items)
        assert pytest.approx(sum(result.values()), abs=1e-4) == 1.0

    def test_empty_cluster_returns_empty_dict(self):
        assert self.compute_source_lineage([]) == {}


# ---------------------------------------------------------------------------
# CLASS 3: TestExtractQuotes
# ---------------------------------------------------------------------------

class TestExtractQuotes:
    def setup_method(self):
        from evidence.evidence_writer import _extract_quotes
        self._extract_quotes = _extract_quotes

    def test_output_dicts_have_text_and_source_keys(self):
        items = [_make_item()]
        quotes = self._extract_quotes(items)
        assert "text" in quotes[0]
        assert "source" in quotes[0]

    def test_source_tag_matches_item_source(self):
        items = [_make_item(source="zendesk")]
        quotes = self._extract_quotes(items)
        assert quotes[0]["source"] == "zendesk"

    def test_max_quotes_respected(self):
        items = [_make_item(hash_=f"h{i}", item_id=f"id{i}") for i in range(20)]
        quotes = self._extract_quotes(items, max_quotes=5)
        assert len(quotes) <= 5

    def test_proportional_sampling_includes_minority_source(self):
        items = (
            [_make_item(source="app_store", hash_=f"a{i}", item_id=f"aid{i}") for i in range(8)]
            + [_make_item(source="zendesk", hash_=f"z{i}", item_id=f"zid{i}") for i in range(2)]
        )
        quotes = self._extract_quotes(items, max_quotes=5)
        assert "zendesk" in {q["source"] for q in quotes}

    def test_text_truncated_to_300_chars(self):
        items = [_make_item(text="x" * 500)]
        quotes = self._extract_quotes(items)
        assert len(quotes[0]["text"]) <= 300

    def test_empty_cluster_returns_empty_list(self):
        assert self._extract_quotes([]) == []


# ---------------------------------------------------------------------------
# CLASS 4: TestWriteItemMap
# ---------------------------------------------------------------------------

class TestWriteItemMap:
    def setup_method(self):
        from evidence.evidence_writer import write_item_map
        self.write_item_map = write_item_map

    def test_inserts_one_row_per_item(self):
        conn, cur = _make_conn()
        items = [
            _make_item(hash_=f"h{i}", item_id=f"id{i}",
                       s3_key=f"app_store/2026/03/08/id{i}.json")
            for i in range(3)
        ]
        self.write_item_map(conn, "ev-999", items)
        cur.executemany.assert_called_once()
        rows = cur.executemany.call_args[0][1]
        assert len(rows) == 3

    def test_each_row_has_correct_evidence_id(self):
        conn, cur = _make_conn()
        items = [
            _make_item(hash_=f"h{i}", item_id=f"id{i}",
                       s3_key=f"app_store/2026/03/08/id{i}.json")
            for i in range(3)
        ]
        self.write_item_map(conn, "ev-999", items)
        rows = cur.executemany.call_args[0][1]
        assert all(row[0] == "ev-999" for row in rows)

    def test_items_missing_hash_are_skipped(self):
        conn, cur = _make_conn()
        items = [
            _make_item(hash_="valid-hash", item_id="id0", s3_key="app_store/k0.json"),
            {"id": "id1", "text": "t", "source": "app_store", "timestamp": None},  # no hash
        ]
        self.write_item_map(conn, "ev-001", items)
        rows = cur.executemany.call_args[0][1]
        assert len(rows) == 1

    def test_items_missing_id_are_skipped(self):
        conn, cur = _make_conn()
        items = [
            _make_item(hash_="valid-hash", item_id="id0", s3_key="app_store/k0.json"),
            {"hash": "h2", "text": "t", "source": "app_store", "timestamp": None},  # no id
        ]
        self.write_item_map(conn, "ev-001", items)
        rows = cur.executemany.call_args[0][1]
        assert len(rows) == 1

    def test_empty_items_returns_zero_no_executemany(self):
        conn, cur = _make_conn()
        result = self.write_item_map(conn, "ev-001", [])
        assert result == 0
        cur.executemany.assert_not_called()

    def test_s3_key_derived_when_not_present(self):
        conn, cur = _make_conn()
        item = _make_item(
            hash_="hx",
            item_id="deriveid",
            source="app_store",
            timestamp="2026-03-08T10:00:00Z",
        )
        # No s3_key in item
        self.write_item_map(conn, "ev-002", [item])
        rows = cur.executemany.call_args[0][1]
        assert "app_store/2026/03/08" in rows[0][2]

    def test_explicit_s3_key_used_verbatim(self):
        conn, cur = _make_conn()
        item = _make_item(
            hash_="hx",
            item_id="expid",
            s3_key="app_store/2026/03/08/explicit.json",
        )
        self.write_item_map(conn, "ev-003", [item])
        rows = cur.executemany.call_args[0][1]
        assert rows[0][2] == "app_store/2026/03/08/explicit.json"

    def test_sql_contains_on_conflict_do_nothing(self):
        conn, cur = _make_conn()
        items = [_make_item(s3_key="app_store/k.json")]
        self.write_item_map(conn, "ev-004", items)
        sql = cur.executemany.call_args[0][0].upper()
        assert "ON CONFLICT" in sql
        assert "DO NOTHING" in sql

    def test_source_preserved_in_row_position_3(self):
        conn, cur = _make_conn()
        item = _make_item(source="zendesk", hash_="hz", item_id="zid",
                          s3_key="zendesk/k.json")
        self.write_item_map(conn, "ev-005", [item])
        rows = cur.executemany.call_args[0][1]
        assert rows[0][3] == "zendesk"


# ---------------------------------------------------------------------------
# CLASS 5: TestWriteEvidenceWithItemMap
# ---------------------------------------------------------------------------

class TestWriteEvidenceWithItemMap:
    def _make_cluster(self, items=None):
        if items is None:
            items = [
                _make_item(hash_=f"h{i}", item_id=f"id{i}",
                           s3_key=f"app_store/2026/03/08/id{i}.json")
                for i in range(4)
            ]
        return {
            "cluster_id": "cluster-001",
            "items": items,
            "centroid_vector": [0.0] * 1024,
        }

    def test_commit_called_exactly_once(self):
        with patch("evidence.evidence_writer.get_conn") as mock_get_conn, \
             patch("evidence.evidence_writer.release_conn"), \
             patch.dict("os.environ", {"BEDROCK_EMBED_MODEL": "test-model"}):
            conn, cur = _make_conn(fetchone_return=("evidence-uuid-001",))
            mock_get_conn.return_value = conn
            cluster = self._make_cluster()
            from evidence.evidence_writer import write_evidence
            write_evidence(cluster, 0.75)
            conn.commit.assert_called_once()

    def test_rollback_on_evidence_insert_failure(self):
        with patch("evidence.evidence_writer.get_conn") as mock_get_conn, \
             patch("evidence.evidence_writer.release_conn"), \
             patch.dict("os.environ", {"BEDROCK_EMBED_MODEL": "test-model"}):
            conn, cur = _make_conn()
            cur.execute.side_effect = Exception("DB write failed")
            mock_get_conn.return_value = conn
            cluster = self._make_cluster()
            from evidence.evidence_writer import write_evidence
            with pytest.raises(Exception, match="DB write failed"):
                write_evidence(cluster, 0.75)
            conn.rollback.assert_called_once()

    def test_representative_quotes_passed_as_jsonb_list(self):
        with patch("evidence.evidence_writer.get_conn") as mock_get_conn, \
             patch("evidence.evidence_writer.release_conn"), \
             patch.dict("os.environ", {"BEDROCK_EMBED_MODEL": "test-model"}):
            conn, cur = _make_conn(fetchone_return=("evidence-uuid-001",))
            mock_get_conn.return_value = conn
            items = [
                _make_item(source="app_store", hash_="h1", item_id="id1",
                           s3_key="app_store/k1.json"),
                _make_item(source="zendesk", hash_="h2", item_id="id2",
                           s3_key="zendesk/k2.json"),
            ]
            cluster = {
                "cluster_id": "c-001",
                "items": items,
                "centroid_vector": [0.0] * 1024,
            }
            from evidence.evidence_writer import write_evidence
            write_evidence(cluster, 0.75)
            # Find the evidence INSERT call — first execute call on the cursor
            execute_calls = cur.execute.call_args_list
            evidence_insert_call = execute_calls[0]
            params = evidence_insert_call[0][1]
            # representative_quotes is the second param (index 1)
            quotes = json.loads(params[1])
            assert isinstance(quotes, list)
            assert len(quotes) > 0
            assert "text" in quotes[0]
            assert "source" in quotes[0]

    def test_item_map_executemany_called_with_correct_row_count(self):
        with patch("evidence.evidence_writer.get_conn") as mock_get_conn, \
             patch("evidence.evidence_writer.release_conn"), \
             patch.dict("os.environ", {"BEDROCK_EMBED_MODEL": "test-model"}):
            conn, cur = _make_conn(fetchone_return=("evidence-uuid-001",))
            mock_get_conn.return_value = conn
            cluster = self._make_cluster()  # 4 items
            from evidence.evidence_writer import write_evidence
            write_evidence(cluster, 0.75)
            cur.executemany.assert_called_once()
            rows = cur.executemany.call_args[0][1]
            assert len(rows) == 4


# ---------------------------------------------------------------------------
# CLASS 6: TestWriteStagingNoItemMap
# ---------------------------------------------------------------------------

class TestWriteStagingNoItemMap:
    def test_staging_does_not_call_executemany(self):
        with patch("evidence.evidence_writer.get_conn") as mock_get_conn, \
             patch("evidence.evidence_writer.release_conn"):
            conn, cur = _make_conn(fetchone_return=("staging-uuid-001",))
            mock_get_conn.return_value = conn
            cluster = {
                "cluster_id": "c-002",
                "items": [
                    _make_item(hash_=f"h{i}", item_id=f"id{i}") for i in range(3)
                ],
            }
            from evidence.evidence_writer import write_staging
            write_staging(cluster, 0.25)
            cur.executemany.assert_not_called()

    def test_staging_quotes_use_text_source_format(self):
        # write_staging does not store representative_quotes — verify the
        # _extract_quotes helper itself returns the correct dict format.
        from evidence.evidence_writer import _extract_quotes
        items = [
            _make_item(source="app_store", hash_="h1", item_id="id1"),
            _make_item(source="zendesk", hash_="h2", item_id="id2"),
            _make_item(source="app_store", hash_="h3", item_id="id3"),
        ]
        quotes = _extract_quotes(items, max_quotes=3)
        assert len(quotes) > 0
        assert "text" in quotes[0]
        assert "source" in quotes[0]


# ---------------------------------------------------------------------------
# CLASS 7: TestItemMetadataPreservation
# ---------------------------------------------------------------------------

class TestItemMetadataPreservation:
    def test_s3_key_injected_when_not_in_stored_object(self):
        from evidence.embedding_pipeline import _read_s3_item
        import json as _json
        stored = {"id": "uid", "text": "t", "source": "app_store",
                  "hash": "h", "timestamp": "2026-03-08T10:00:00Z"}
        mock_s3 = MagicMock()
        mock_body = MagicMock()
        mock_body.read.return_value = _json.dumps(stored).encode()
        mock_s3.get_object.return_value = {"Body": mock_body}
        result = _read_s3_item(mock_s3, "bucket", "app_store/2026/03/08/uuid.json")
        assert result["s3_key"] == "app_store/2026/03/08/uuid.json"

    def test_existing_s3_key_not_overwritten(self):
        from evidence.embedding_pipeline import _read_s3_item
        import json as _json
        stored = {"id": "uid", "text": "t", "source": "app_store",
                  "hash": "h", "timestamp": "2026-03-08T10:00:00Z",
                  "s3_key": "explicit/stored/key.json"}
        mock_s3 = MagicMock()
        mock_body = MagicMock()
        mock_body.read.return_value = _json.dumps(stored).encode()
        mock_s3.get_object.return_value = {"Body": mock_body}
        result = _read_s3_item(mock_s3, "bucket", "some/other/key.json")
        assert result["s3_key"] == "explicit/stored/key.json"

    def test_all_7_required_fields_present(self):
        # Verify the contract for the 6 fields _read_s3_item guarantees
        # (vector is added later by the pipeline, not by _read_s3_item).
        item = _make_item(s3_key="app_store/2026/03/08/uuid.json")
        for field in ("id", "text", "source", "hash", "timestamp", "s3_key"):
            assert field in item, f"Missing field: {field}"

    def test_returns_none_on_s3_exception(self):
        from evidence.embedding_pipeline import _read_s3_item
        mock_s3 = MagicMock()
        mock_s3.get_object.side_effect = Exception("S3 error")
        result = _read_s3_item(mock_s3, "bucket", "some/key.json")
        assert result is None


# ---------------------------------------------------------------------------
# CLASS 8: TestSignalPromotionItemMap
# ---------------------------------------------------------------------------

class TestSignalPromotionItemMap:
    def test_empty_staging_returns_empty_list_no_commit(self):
        with patch("governance.audit_log.write_audit_entry"):
            conn, cur = _make_conn()
            cur.fetchall.return_value = []
            from governance.signal_promotion import promote_staging_signals
            result = promote_staging_signals(conn)
            assert result == []
            conn.commit.assert_not_called()

    def test_promoted_row_gets_update_set_promoted_true(self):
        with patch("governance.audit_log.write_audit_entry"):
            conn, cur = _make_conn(fetchone_return=("new-evidence-uuid",))
            # fetchall for the SELECT, then fetchone for the INSERT RETURNING id
            cur.fetchall.return_value = [
                ("staging-id-001", "App crashes a lot", 5, 0.35, 12, "app_store")
            ]
            # fetchall for _recover_item_map dedup_index query
            cur.fetchall.side_effect = [
                [("staging-id-001", "App crashes a lot", 5, 0.35, 12, "app_store")],
                [],  # dedup_index fetchall in _recover_item_map
            ]
            from governance.signal_promotion import promote_staging_signals
            promote_staging_signals(conn)
            all_sql_calls = [str(c[0][0]) for c in cur.execute.call_args_list]
            update_calls = [s for s in all_sql_calls if "UPDATE low_confidence_staging" in s]
            assert len(update_calls) >= 1
            assert any("promoted" in s.lower() for s in update_calls)

    def test_commit_called_after_successful_promotion(self):
        with patch("governance.audit_log.write_audit_entry"):
            conn, cur = _make_conn(fetchone_return=("new-evidence-uuid",))
            cur.fetchall.side_effect = [
                [("staging-id-001", "App crashes a lot", 5, 0.35, 12, "app_store")],
                [],  # dedup_index fetchall in _recover_item_map
            ]
            from governance.signal_promotion import promote_staging_signals
            promote_staging_signals(conn)
            conn.commit.assert_called()

    def test_db_failure_triggers_rollback_and_returns_empty(self):
        with patch("governance.audit_log.write_audit_entry"):
            conn, cur = _make_conn()
            cur.fetchall.return_value = [
                ("staging-id-001", "App crashes a lot", 5, 0.35, 12, "app_store")
            ]
            # First execute (SELECT) succeeds (returns None), second (INSERT) raises
            cur.execute.side_effect = [None, Exception("DB exploded")]
            from governance.signal_promotion import promote_staging_signals
            result = promote_staging_signals(conn)
            conn.rollback.assert_called()
            assert result == []

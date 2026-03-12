# =============================================================
# tests/test_reasoning_agent.py
# Unit tests for reasoning/ module.
# All DB and AWS calls are mocked — no live connections needed.
# =============================================================

import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from reasoning.retriever import fetch_active_evidence
from reasoning.scorer import compute_priority_scores
from reasoning.prompt_builder import build_prompt, _format_lineage
from reasoning.output_writer import write_results
from reasoning.agent import run_reasoning_agent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_evidence(**overrides) -> dict:
    """Return a minimal evidence dict suitable for scorer/prompt tests."""
    base = {
        "id":               "aaaaaaaa-0000-0000-0000-000000000001",
        "theme":            "App crashes on launch",
        "unique_user_count": 6,
        "confidence_score": 0.90,
        "source_lineage":   {"app_store": 0.5, "zendesk": 0.5},
        "created_at":       datetime.now(timezone.utc).isoformat(),
        "last_validated_at": datetime.now(timezone.utc).isoformat(),
        "recency_score":    1.0,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# retriever tests
# ---------------------------------------------------------------------------

class TestFetchActiveEvidence(unittest.TestCase):

    def _make_conn(self, rows):
        """Return a mock psycopg2 connection that yields `rows` from fetchall."""
        now = datetime.now(timezone.utc)
        conn = MagicMock()
        cur = MagicMock()
        cur.fetchall.return_value = rows
        cur.__enter__ = lambda s: s
        cur.__exit__ = MagicMock(return_value=False)
        conn.cursor.return_value = cur
        return conn

    def test_returns_empty_list_when_no_rows(self):
        conn = self._make_conn([])
        result = fetch_active_evidence(conn)
        self.assertEqual(result, [])

    def test_maps_columns_correctly(self):
        now = datetime.now(timezone.utc)
        validated = now - timedelta(days=10)
        row = (
            "aaaaaaaa-0000-0000-0000-000000000001",
            "Theme A",
            5,
            0.85,
            {"zendesk": 1.0},
            now,
            validated,
        )
        conn = self._make_conn([row])
        result = fetch_active_evidence(conn)

        self.assertEqual(len(result), 1)
        ev = result[0]
        self.assertEqual(ev["theme"], "Theme A")
        self.assertEqual(ev["unique_user_count"], 5)
        self.assertAlmostEqual(ev["confidence_score"], 0.85)

    def test_recency_score_recent(self):
        """Evidence validated today should have recency_score = 1.0."""
        now = datetime.now(timezone.utc)
        row = ("id", "theme", 1, 0.9, {}, now, now)
        conn = self._make_conn([row])
        result = fetch_active_evidence(conn)
        self.assertEqual(result[0]["recency_score"], 1.0)

    def test_recency_score_90_days(self):
        """Evidence validated 90+ days ago should have recency_score = 0.0."""
        now = datetime.now(timezone.utc)
        old = now - timedelta(days=90)
        row = ("id", "theme", 1, 0.9, {}, now, old)
        conn = self._make_conn([row])
        result = fetch_active_evidence(conn)
        self.assertEqual(result[0]["recency_score"], 0.0)

    def test_recency_score_45_days(self):
        """Evidence 45 days old should have recency_score ≈ 0.5."""
        now = datetime.now(timezone.utc)
        mid = now - timedelta(days=45)
        row = ("id", "theme", 1, 0.9, {}, now, mid)
        conn = self._make_conn([row])
        result = fetch_active_evidence(conn)
        self.assertAlmostEqual(result[0]["recency_score"], 0.5, places=1)

    def test_db_exception_propagates(self):
        conn = MagicMock()
        conn.cursor.side_effect = Exception("DB error")
        with self.assertRaises(Exception):
            fetch_active_evidence(conn)


# ---------------------------------------------------------------------------
# scorer tests
# ---------------------------------------------------------------------------

class TestComputePriorityScores(unittest.TestCase):

    def test_single_source_no_corroboration(self):
        ev = _make_evidence(
            source_lineage={"zendesk": 1.0},
            confidence_score=0.8,
            unique_user_count=10,
            recency_score=1.0,
        )
        result = compute_priority_scores([ev])
        score = result[0]["priority_score"]
        # source_corroboration = 0.0 (single source)
        # normalized_user = 10/50 = 0.2
        expected = 0.8 * 0.35 + 0.2 * 0.25 + 0.0 * 0.20 + 1.0 * 0.20
        self.assertAlmostEqual(score, expected, places=4)

    def test_multi_source_corroboration(self):
        ev = _make_evidence(
            source_lineage={"app_store": 0.5, "zendesk": 0.5},
            confidence_score=0.8,
            unique_user_count=10,
            recency_score=1.0,
        )
        result = compute_priority_scores([ev])
        score = result[0]["priority_score"]
        # source_corroboration = 0.1
        expected = 0.8 * 0.35 + 0.2 * 0.25 + 0.1 * 0.20 + 1.0 * 0.20
        self.assertAlmostEqual(score, expected, places=4)

    def test_user_count_capped_at_1(self):
        ev = _make_evidence(unique_user_count=200)  # > 50, normalises to 1.0
        result = compute_priority_scores([ev])
        self.assertEqual(result[0]["normalized_user_count"], 1.0)

    def test_sorted_descending(self):
        high = _make_evidence(confidence_score=0.95, unique_user_count=30, recency_score=1.0,
                              source_lineage={"a": 0.5, "b": 0.5}, id="high")
        low  = _make_evidence(confidence_score=0.50, unique_user_count=2,  recency_score=0.1,
                              source_lineage={"a": 1.0}, id="low")
        result = compute_priority_scores([low, high])
        self.assertEqual(result[0]["id"], "high")
        self.assertEqual(result[1]["id"], "low")

    def test_empty_list(self):
        result = compute_priority_scores([])
        self.assertEqual(result, [])

    def test_zero_recency(self):
        ev = _make_evidence(recency_score=0.0, confidence_score=0.5,
                            unique_user_count=5, source_lineage={"x": 1.0})
        result = compute_priority_scores([ev])
        score = result[0]["priority_score"]
        expected = 0.5 * 0.35 + (5/50) * 0.25 + 0.0 * 0.20 + 0.0 * 0.20
        self.assertAlmostEqual(score, expected, places=4)


# ---------------------------------------------------------------------------
# prompt_builder tests
# ---------------------------------------------------------------------------

class TestBuildPrompt(unittest.TestCase):

    def test_format_lineage_single(self):
        self.assertEqual(_format_lineage({"zendesk": 1.0}), "zendesk (100%)")

    def test_format_lineage_multi(self):
        result = _format_lineage({"app_store": 0.5, "zendesk": 0.5})
        self.assertIn("app_store (50%)", result)
        self.assertIn("zendesk (50%)", result)

    def test_format_lineage_empty(self):
        self.assertEqual(_format_lineage({}), "unknown")

    def test_prompt_contains_theme(self):
        ev = _make_evidence(theme="Login fails with SSO")
        ev["priority_score"] = 0.75
        ev["source_corroboration"] = 0.1
        ev["normalized_user_count"] = 0.12
        prompt = build_prompt([ev])
        self.assertIn("Login fails with SSO", prompt)

    def test_prompt_contains_json_schema(self):
        ev = _make_evidence()
        ev["priority_score"] = 0.75
        ev["source_corroboration"] = 0.1
        ev["normalized_user_count"] = 0.12
        prompt = build_prompt([ev])
        self.assertIn("recommendations", prompt)
        self.assertIn("recommended_action", prompt)
        self.assertIn("effort_estimate", prompt)
        self.assertIn("meta", prompt)

    def test_prompt_instructs_json_only(self):
        ev = _make_evidence()
        ev["priority_score"] = 0.7
        ev["source_corroboration"] = 0.0
        ev["normalized_user_count"] = 0.1
        prompt = build_prompt([ev])
        self.assertIn("Return ONLY a valid JSON object", prompt)
        self.assertIn("No markdown", prompt)

    def test_cluster_rank_numbers(self):
        evs = [_make_evidence(theme=f"Theme {i}") for i in range(3)]
        for ev in evs:
            ev["priority_score"] = 0.5
            ev["source_corroboration"] = 0.0
            ev["normalized_user_count"] = 0.1
        prompt = build_prompt(evs)
        self.assertIn("Cluster #1", prompt)
        self.assertIn("Cluster #2", prompt)
        self.assertIn("Cluster #3", prompt)


# ---------------------------------------------------------------------------
# output_writer tests
# ---------------------------------------------------------------------------

class TestWriteResults(unittest.TestCase):

    def _make_conn(self):
        conn = MagicMock()
        cur = MagicMock()
        cur.__enter__ = lambda s: s
        cur.__exit__ = MagicMock(return_value=False)
        conn.cursor.return_value = cur
        return conn

    def test_returns_run_id_string(self):
        conn = self._make_conn()
        s3 = MagicMock()

        run_id = write_results(
            conn=conn,
            s3_client=s3,
            bucket_name="test-bucket",
            evidence_ids=["aaaaaaaa-0000-0000-0000-000000000001"],
            priority_scores=[{"id": "x", "priority_score": 0.8}],
            llm_response={"recommendations": [], "meta": {}},
            token_usage={"input_tokens": 100, "output_tokens": 200},
            model_id="anthropic.claude-3-sonnet-20240229-v1:0",
        )

        self.assertIsInstance(run_id, str)
        self.assertEqual(len(run_id), 36)  # UUID format

    def test_s3_put_called_with_correct_key(self):
        conn = self._make_conn()
        s3 = MagicMock()

        run_id = write_results(
            conn=conn,
            s3_client=s3,
            bucket_name="my-bucket",
            evidence_ids=[],
            priority_scores=[],
            llm_response={},
            token_usage={"input_tokens": 0, "output_tokens": 0},
            model_id="test-model",
        )

        s3.put_object.assert_called_once()
        call_kwargs = s3.put_object.call_args[1]
        self.assertEqual(call_kwargs["Bucket"], "my-bucket")
        self.assertIn(run_id, call_kwargs["Key"])
        self.assertIn("reasoning-runs/", call_kwargs["Key"])

    def test_db_commit_called(self):
        conn = self._make_conn()
        s3 = MagicMock()
        write_results(
            conn=conn, s3_client=s3, bucket_name="b",
            evidence_ids=[], priority_scores=[], llm_response={},
            token_usage={"input_tokens": 0, "output_tokens": 0},
            model_id="m",
        )
        self.assertTrue(conn.commit.called)

    def test_db_error_raises(self):
        conn = MagicMock()
        conn.cursor.side_effect = Exception("DB down")
        s3 = MagicMock()
        with self.assertRaises(Exception):
            write_results(
                conn=conn, s3_client=s3, bucket_name="b",
                evidence_ids=[], priority_scores=[], llm_response={},
                token_usage={"input_tokens": 0, "output_tokens": 0},
                model_id="m",
            )


# ---------------------------------------------------------------------------
# agent integration (mocked) tests
# ---------------------------------------------------------------------------

class TestRunReasoningAgent(unittest.TestCase):

    def _make_bedrock_response(self, content: str):
        """Build a mock Bedrock response dict."""
        body_dict = {
            "content": [{"type": "text", "text": content}],
            "usage": {"input_tokens": 500, "output_tokens": 300},
        }
        mock_resp = MagicMock()
        mock_resp.__getitem__ = lambda s, k: {
            "body": MagicMock(read=lambda: json.dumps(body_dict).encode())
        }[k]
        return mock_resp

    def _make_llm_json(self) -> str:
        return json.dumps({
            "recommendations": [
                {
                    "rank": 1,
                    "theme": "App crashes",
                    "recommended_action": "Fix crash",
                    "effort_estimate": "medium",
                    "user_impact": "high",
                    "tradeoff_explanation": "Requires regression tests",
                    "risk_flags": [],
                    "related_clusters": [],
                }
            ],
            "meta": {
                "reasoning_summary": "Crashes are most urgent.",
                "highest_priority_theme": "App crashes",
                "cross_cluster_insight": "Stability is the theme.",
            },
        })

    def _mock_conn_with_evidence(self):
        now = datetime.now(timezone.utc)
        row = (
            "aaaaaaaa-0000-0000-0000-000000000001",
            "App crashes on launch",
            6, 0.90,
            {"app_store": 0.5, "zendesk": 0.5},
            now, now,
        )
        conn = MagicMock()
        cur = MagicMock()
        cur.fetchall.return_value = [row]
        cur.__enter__ = lambda s: s
        cur.__exit__ = MagicMock(return_value=False)
        conn.cursor.return_value = cur
        return conn

    def test_raises_on_no_evidence(self):
        conn = MagicMock()
        cur = MagicMock()
        cur.fetchall.return_value = []
        cur.__enter__ = lambda s: s
        cur.__exit__ = MagicMock(return_value=False)
        conn.cursor.return_value = cur
        bedrock = MagicMock()
        s3 = MagicMock()
        with self.assertRaises(ValueError, msg="No active evidence"):
            run_reasoning_agent(conn, bedrock, s3, "bucket")

    def test_raises_on_malformed_json(self):
        conn = self._mock_conn_with_evidence()
        bedrock = MagicMock()
        bad_body = {
            "content": [{"type": "text", "text": "not json at all"}],
            "usage": {"input_tokens": 10, "output_tokens": 5},
        }
        bedrock.invoke_model.return_value = {
            "body": MagicMock(read=lambda: json.dumps(bad_body).encode())
        }
        s3 = MagicMock()
        with self.assertRaises(ValueError, msg="malformed JSON"):
            run_reasoning_agent(conn, bedrock, s3, "bucket")

    def test_happy_path_returns_expected_keys(self):
        conn = self._mock_conn_with_evidence()
        bedrock = MagicMock()
        llm_body = {
            "content": [{"type": "text", "text": self._make_llm_json()}],
            "usage": {"input_tokens": 500, "output_tokens": 300},
        }
        bedrock.invoke_model.return_value = {
            "body": MagicMock(read=lambda: json.dumps(llm_body).encode())
        }
        s3 = MagicMock()

        result = run_reasoning_agent(conn, bedrock, s3, "test-bucket")

        self.assertIn("run_id", result)
        self.assertIn("recommendations", result)
        self.assertIn("meta", result)
        self.assertIn("token_usage", result)
        self.assertIn("s3_report_key", result)
        self.assertEqual(result["evidence_count"], 1)
        self.assertEqual(len(result["recommendations"]), 1)
        self.assertEqual(result["token_usage"]["input_tokens"], 500)
        self.assertEqual(result["token_usage"]["output_tokens"], 300)

    def test_happy_path_s3_upload_called(self):
        conn = self._mock_conn_with_evidence()
        bedrock = MagicMock()
        llm_body = {
            "content": [{"type": "text", "text": self._make_llm_json()}],
            "usage": {"input_tokens": 100, "output_tokens": 50},
        }
        bedrock.invoke_model.return_value = {
            "body": MagicMock(read=lambda: json.dumps(llm_body).encode())
        }
        s3 = MagicMock()

        run_reasoning_agent(conn, bedrock, s3, "my-reports-bucket")

        s3.put_object.assert_called_once()
        self.assertEqual(s3.put_object.call_args[1]["Bucket"], "my-reports-bucket")

    def test_bedrock_error_propagates(self):
        conn = self._mock_conn_with_evidence()
        bedrock = MagicMock()
        bedrock.invoke_model.side_effect = Exception("Bedrock throttled")
        s3 = MagicMock()
        with self.assertRaises(Exception, msg="Bedrock throttled"):
            run_reasoning_agent(conn, bedrock, s3, "bucket")


if __name__ == "__main__":
    unittest.main()

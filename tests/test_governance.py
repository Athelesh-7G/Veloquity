# =============================================================
# tests/test_governance.py
# Unit tests for Phase 4: Governance Agent modules.
# All DB and AWS calls are mocked — no real connections needed.
# =============================================================

import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from governance.audit_log import write_audit_entry
from governance.stale_detection import detect_and_flag_stale
from governance.signal_promotion import promote_staging_signals
from governance.cost_monitor import check_cost_signals
from output.html_report import generate_and_upload, _esc


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _make_conn(fetchall_results=None, fetchone_results=None):
    """Return a mock psycopg2 connection with a cursor stub."""
    conn = MagicMock()
    ctx = MagicMock()
    cur = MagicMock()
    ctx.__enter__ = MagicMock(return_value=cur)
    ctx.__exit__ = MagicMock(return_value=False)
    conn.cursor.return_value = ctx

    if fetchall_results is not None:
        cur.fetchall.side_effect = fetchall_results
    if fetchone_results is not None:
        cur.fetchone.side_effect = fetchone_results

    return conn, cur


# ─────────────────────────────────────────────────────────────
# audit_log
# ─────────────────────────────────────────────────────────────

class TestWriteAuditEntry(unittest.TestCase):

    def test_inserts_correct_values(self):
        """write_audit_entry executes INSERT with correct event_type and details."""
        conn, cur = _make_conn()
        write_audit_entry(conn, "stale_flagged", {"days_stale": 45}, "uuid-123")
        args = cur.execute.call_args[0]
        self.assertIn("INSERT INTO governance_log", args[0])
        self.assertEqual(args[1][0], "stale_flagged")
        self.assertEqual(args[1][1], "uuid-123")
        self.assertIn("days_stale", args[1][2])

    def test_target_id_nullable(self):
        """write_audit_entry accepts None target_id."""
        conn, cur = _make_conn()
        write_audit_entry(conn, "cost_alert", {}, None)
        args = cur.execute.call_args[0]
        self.assertIsNone(args[1][1])

    def test_empty_details_defaults_to_empty_dict(self):
        """write_audit_entry uses empty dict when details not provided."""
        conn, cur = _make_conn()
        write_audit_entry(conn, "test_event")
        args = cur.execute.call_args[0]
        self.assertEqual(json.loads(args[1][2]), {})


# ─────────────────────────────────────────────────────────────
# stale_detection
# ─────────────────────────────────────────────────────────────

class TestDetectAndFlagStale(unittest.TestCase):

    def _stale_row(self, days_old=45):
        """Build a fake evidence row that is `days_old` days old."""
        ts = datetime.now(tz=timezone.utc) - timedelta(days=days_old)
        return ("ev-uuid-1", "Crash on startup", ts)

    def test_empty_returns_empty_list(self):
        """detect_and_flag_stale returns [] when no stale evidence exists."""
        conn, cur = _make_conn(fetchall_results=[[]])
        result = detect_and_flag_stale(conn)
        self.assertEqual(result, [])

    def test_stale_row_is_updated(self):
        """detect_and_flag_stale calls UPDATE for each stale row."""
        conn, cur = _make_conn(fetchall_results=[[self._stale_row(45)]])
        with patch("governance.stale_detection.write_audit_entry"):
            result = detect_and_flag_stale(conn)
        self.assertEqual(len(result), 1)
        update_calls = [
            c for c in cur.execute.call_args_list
            if "UPDATE evidence" in str(c)
        ]
        self.assertEqual(len(update_calls), 1)

    def test_days_stale_calculated_correctly(self):
        """days_stale in returned dict is approximately correct."""
        conn, cur = _make_conn(fetchall_results=[[self._stale_row(60)]])
        with patch("governance.stale_detection.write_audit_entry"):
            result = detect_and_flag_stale(conn)
        self.assertAlmostEqual(result[0]["days_stale"], 60, delta=1)

    def test_audit_entry_written_for_each_row(self):
        """write_audit_entry is called once per stale row."""
        rows = [self._stale_row(31), self._stale_row(90)]
        conn, cur = _make_conn(fetchall_results=[rows])
        with patch("governance.stale_detection.write_audit_entry") as mock_audit:
            detect_and_flag_stale(conn)
        self.assertEqual(mock_audit.call_count, 2)

    def test_returned_dict_has_correct_keys(self):
        """detect_and_flag_stale returns dicts with id, theme, days_stale."""
        conn, cur = _make_conn(fetchall_results=[[self._stale_row(35)]])
        with patch("governance.stale_detection.write_audit_entry"):
            result = detect_and_flag_stale(conn)
        self.assertIn("id", result[0])
        self.assertIn("theme", result[0])
        self.assertIn("days_stale", result[0])

    def test_commit_called_per_row(self):
        """conn.commit is called after each stale row is processed."""
        conn, cur = _make_conn(fetchall_results=[[self._stale_row(40), self._stale_row(50)]])
        with patch("governance.stale_detection.write_audit_entry"):
            detect_and_flag_stale(conn)
        self.assertEqual(conn.commit.call_count, 2)


# ─────────────────────────────────────────────────────────────
# signal_promotion
# ─────────────────────────────────────────────────────────────

class TestPromoteStagingSignals(unittest.TestCase):

    def _staging_row(self, freq=15):
        """Build a fake staging row with given frequency."""
        return ("stg-uuid-1", "Users want dark mode", 12, 0.55, freq, "app_store")

    def test_empty_returns_empty_list(self):
        """promote_staging_signals returns [] when no promotable rows exist."""
        conn, cur = _make_conn(fetchall_results=[[]])
        result = promote_staging_signals(conn)
        self.assertEqual(result, [])

    def test_inserts_into_evidence(self):
        """promote_staging_signals executes INSERT into evidence for each row."""
        conn, cur = _make_conn(fetchall_results=[[self._staging_row()]])
        with patch("governance.signal_promotion.write_audit_entry"):
            result = promote_staging_signals(conn)
        self.assertEqual(len(result), 1)
        insert_calls = [c for c in cur.execute.call_args_list if "INSERT INTO evidence" in str(c)]
        self.assertEqual(len(insert_calls), 1)

    def test_marks_staging_promoted(self):
        """promote_staging_signals sets promoted=TRUE on the staging row."""
        conn, cur = _make_conn(fetchall_results=[[self._staging_row()]])
        with patch("governance.signal_promotion.write_audit_entry"):
            promote_staging_signals(conn)
        update_calls = [c for c in cur.execute.call_args_list if "promoted = TRUE" in str(c)]
        self.assertEqual(len(update_calls), 1)

    def test_audit_entry_written(self):
        """write_audit_entry is called once per promoted signal."""
        conn, cur = _make_conn(fetchall_results=[[self._staging_row(), self._staging_row(20)]])
        with patch("governance.signal_promotion.write_audit_entry") as mock_audit:
            promote_staging_signals(conn)
        self.assertEqual(mock_audit.call_count, 2)

    def test_returned_dict_keys(self):
        """promote_staging_signals returns dicts with expected keys."""
        conn, cur = _make_conn(fetchall_results=[[self._staging_row()]])
        with patch("governance.signal_promotion.write_audit_entry"):
            result = promote_staging_signals(conn)
        self.assertIn("staging_id", result[0])
        self.assertIn("frequency", result[0])
        self.assertIn("confidence_score", result[0])


# ─────────────────────────────────────────────────────────────
# cost_monitor
# ─────────────────────────────────────────────────────────────

class TestCheckCostSignals(unittest.TestCase):

    def _conn_with_counts(self, cache_count, evidence_count):
        """Return a mock conn that yields given counts from fetchone."""
        conn, cur = _make_conn(fetchone_results=[(cache_count,), (evidence_count,)])
        return conn, cur

    def test_no_alert_when_cache_adequate(self):
        """alert_triggered is False when cache_count >= 40% of evidence_count."""
        conn, _ = self._conn_with_counts(cache_count=50, evidence_count=100)
        with patch("governance.cost_monitor.write_audit_entry"):
            result = check_cost_signals(conn)
        self.assertFalse(result["alert_triggered"])

    def test_alert_when_cache_low(self):
        """alert_triggered is True when cache_count < 40% of evidence_count."""
        conn, _ = self._conn_with_counts(cache_count=3, evidence_count=100)
        with patch("governance.cost_monitor.write_audit_entry") as mock_audit:
            result = check_cost_signals(conn)
        self.assertTrue(result["alert_triggered"])
        mock_audit.assert_called_once()

    def test_no_alert_when_no_evidence(self):
        """alert_triggered is False when evidence_count is 0 (avoid division by zero)."""
        conn, _ = self._conn_with_counts(cache_count=0, evidence_count=0)
        with patch("governance.cost_monitor.write_audit_entry"):
            result = check_cost_signals(conn)
        self.assertFalse(result["alert_triggered"])

    def test_returned_dict_keys(self):
        """check_cost_signals returns dict with cache_count, evidence_count, alert_triggered."""
        conn, _ = self._conn_with_counts(10, 20)
        with patch("governance.cost_monitor.write_audit_entry"):
            result = check_cost_signals(conn)
        self.assertIn("cache_count", result)
        self.assertIn("evidence_count", result)
        self.assertIn("alert_triggered", result)

    def test_counts_are_returned_correctly(self):
        """check_cost_signals returns the exact counts from DB."""
        conn, _ = self._conn_with_counts(55, 4)
        with patch("governance.cost_monitor.write_audit_entry"):
            result = check_cost_signals(conn)
        self.assertEqual(result["cache_count"], 55)
        self.assertEqual(result["evidence_count"], 4)


# ─────────────────────────────────────────────────────────────
# html_report
# ─────────────────────────────────────────────────────────────

class TestHtmlReport(unittest.TestCase):

    def _make_report_conn(self):
        """Build a mock conn with preset query results for generate_and_upload."""
        conn = MagicMock()
        cur = MagicMock()
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=cur)
        ctx.__exit__ = MagicMock(return_value=False)
        conn.cursor.return_value = ctx

        import uuid
        run_id = uuid.uuid4()
        run_at = datetime(2026, 3, 8, 12, 0, tzinfo=timezone.utc)
        llm_response = {
            "recommendations": [
                {
                    "rank": 1, "theme": "Crash on launch",
                    "recommended_action": "Fix crash",
                    "effort_estimate": "high", "user_impact": "high",
                    "tradeoff_explanation": "Needs investigation",
                    "risk_flags": [], "related_clusters": [],
                }
            ]
        }
        token_usage = {"input_tokens": 500, "output_tokens": 200}
        evidence_row = (
            uuid.uuid4(), "Dark mode request", 0.85, 10,
            ["app_store"], datetime(2026, 3, 8, tzinfo=timezone.utc),
        )
        gov_row = (
            "stale_flagged",
            datetime(2026, 3, 8, 10, 0, tzinfo=timezone.utc),
            {"days_stale": 35},
        )

        cur.fetchone.side_effect = [(run_id, run_at, llm_response, None, token_usage)]
        cur.fetchall.side_effect = [[evidence_row], [gov_row]]
        return conn

    def test_returns_url_string(self):
        """generate_and_upload returns a URL string containing bucket name."""
        conn = self._make_report_conn()
        s3 = MagicMock()
        result = generate_and_upload(conn, s3, "test-bucket")
        self.assertIsInstance(result, str)
        self.assertIn("test-bucket", result)

    def test_s3_put_called(self):
        """generate_and_upload calls s3_client.put_object."""
        conn = self._make_report_conn()
        s3 = MagicMock()
        generate_and_upload(conn, s3, "test-bucket")
        self.assertTrue(s3.put_object.called)

    def test_presigned_url_fallback_on_access_denied(self):
        """Falls back to pre-signed URL when public-read ACL is denied."""
        from botocore.exceptions import ClientError
        conn = self._make_report_conn()
        s3 = MagicMock()
        error_response = {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}
        s3.put_object.side_effect = [ClientError(error_response, "PutObject"), None]
        s3.generate_presigned_url.return_value = "https://presigned.url/key?sig=abc"
        result = generate_and_upload(conn, s3, "test-bucket")
        self.assertEqual(result, "https://presigned.url/key?sig=abc")
        self.assertEqual(s3.put_object.call_count, 2)

    def test_html_contains_recommendation_theme(self):
        """Generated HTML includes the recommendation theme text."""
        conn = self._make_report_conn()
        s3 = MagicMock()
        captured = []
        def capture(**kwargs):
            captured.append(kwargs.get("Body", b"").decode("utf-8"))
        s3.put_object.side_effect = capture
        generate_and_upload(conn, s3, "test-bucket")
        self.assertTrue(captured)
        self.assertIn("Crash on launch", captured[0])

    def test_html_contains_evidence_theme(self):
        """Generated HTML includes the evidence cluster theme."""
        conn = self._make_report_conn()
        s3 = MagicMock()
        captured = []
        def capture(**kwargs):
            captured.append(kwargs.get("Body", b"").decode("utf-8"))
        s3.put_object.side_effect = capture
        generate_and_upload(conn, s3, "test-bucket")
        self.assertIn("Dark mode request", captured[0])

    def test_esc_prevents_xss(self):
        """_esc escapes HTML special characters."""
        self.assertEqual(_esc("<script>"), "&lt;script&gt;")
        self.assertEqual(_esc('say "hi"'), "say &quot;hi&quot;")
        self.assertEqual(_esc("a & b"), "a &amp; b")


if __name__ == "__main__":
    unittest.main()

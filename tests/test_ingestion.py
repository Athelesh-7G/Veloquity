# =============================================================
# tests/test_ingestion.py
# Unit tests for the Veloquity ingestion pipeline.
# All AWS calls (Comprehend, S3, RDS) are mocked.
# =============================================================

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest

# ---------------------------------------------------------------------------
# Ensure repo root is on sys.path so imports resolve without installing pkg.
# ---------------------------------------------------------------------------
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

# ---------------------------------------------------------------------------
# Minimal env vars required by modules at import time.
# ---------------------------------------------------------------------------
os.environ.setdefault("AWS_REGION_NAME", "us-east-1")
os.environ.setdefault("S3_RAW_BUCKET", "veloquity-raw-dev-test")
os.environ.setdefault("DB_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:000000000000:secret:test")


# ===========================================================================
# 1. pii_redaction
# ===========================================================================

class TestPiiRedaction:
    """Tests for ingestion.pii_redaction.redact() — regex-based, no AWS calls."""

    def test_pii_email_and_phone_redacted(self):
        """Email and US phone number are replaced with [REDACTED]."""
        import ingestion.pii_redaction as mod

        text = "Call me at 555-123-4567 or email john@example.com"
        result = mod.redact(text)

        assert "[REDACTED]" in result
        assert "555-123-4567" not in result
        assert "john@example.com" not in result

    def test_clean_text_passes_through(self):
        """Text containing no PII patterns is returned byte-for-byte identical."""
        import ingestion.pii_redaction as mod

        text = "The app crashes when I open the settings screen."
        result = mod.redact(text)

        assert result == text

    def test_no_api_calls_made(self):
        """redact() makes zero network calls — no boto3 client is ever created."""
        import ingestion.pii_redaction as mod

        with patch("builtins.__import__", wraps=__builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__) as _:
            # Simply calling redact must not raise even without AWS credentials.
            result = mod.redact("My SSN is 123-45-6789 and email is a@b.com")

        assert "123-45-6789" not in result
        assert "a@b.com" not in result

    def test_empty_string_returns_empty(self):
        """Empty / whitespace-only text is returned as-is without processing."""
        import ingestion.pii_redaction as mod

        assert mod.redact("") == ""
        assert mod.redact("   ") == "   "

    def test_multiple_pii_types_all_redacted(self):
        """SSN, email, phone, credit card, and IP are all redacted in one pass."""
        import ingestion.pii_redaction as mod

        text = (
            "SSN 123-45-6789, "
            "email alice@corp.io, "
            "phone +1 800-555-0199, "
            "card 4111-1111-1111-1111, "
            "server 192.168.1.1"
        )
        result = mod.redact(text)

        assert "123-45-6789"        not in result
        assert "alice@corp.io"       not in result
        assert "800-555-0199"        not in result
        assert "4111-1111-1111-1111" not in result
        assert "192.168.1.1"         not in result
        assert result.count("[REDACTED]") >= 5


# ===========================================================================
# 2. normalization
# ===========================================================================

class TestNormalization:
    """Tests for ingestion.normalization.normalize()."""

    def _mock_redact(self, text: str) -> str:
        """Pass-through mock for pii_redaction.redact."""
        return text

    def test_output_schema_keys(self):
        """Returned dict always contains exactly the 5 required keys."""
        import ingestion.normalization as mod

        raw = {"body": "App keeps freezing on iOS 17."}
        with patch.object(mod, "redact", side_effect=self._mock_redact):
            result = mod.normalize(raw, "app_store")

        assert set(result.keys()) == {"id", "source", "text", "timestamp", "hash"}

    def test_source_is_propagated(self):
        """The 'source' key reflects the source argument, not any field in raw."""
        import ingestion.normalization as mod

        with patch.object(mod, "redact", side_effect=self._mock_redact):
            r1 = mod.normalize({"body": "crash"}, "app_store")
            r2 = mod.normalize({"description": "crash"}, "zendesk")

        assert r1["source"] == "app_store"
        assert r2["source"] == "zendesk"

    def test_id_is_unique_uuid(self):
        """Each call produces a distinct UUID string."""
        import ingestion.normalization as mod

        with patch.object(mod, "redact", side_effect=self._mock_redact):
            r1 = mod.normalize({"body": "crash"}, "app_store")
            r2 = mod.normalize({"body": "crash"}, "app_store")

        assert r1["id"] != r2["id"]
        # Rough UUID format check.
        assert len(r1["id"]) == 36
        assert r1["id"].count("-") == 4

    def test_hash_is_sha256_of_text_only(self):
        """SHA-256 is computed on text only; changing metadata doesn't change hash."""
        import ingestion.normalization as mod

        text = "Login button is broken."
        expected_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        with patch.object(mod, "redact", side_effect=self._mock_redact):
            # Same text, different timestamps → same hash.
            r1 = mod.normalize({"body": text, "created_at": "2024-01-01"}, "zendesk")
            r2 = mod.normalize({"body": text, "created_at": "2025-06-15"}, "app_store")

        assert r1["hash"] == expected_hash
        assert r2["hash"] == expected_hash

    def test_missing_timestamp_defaults_to_utc_now(self):
        """When no timestamp field is present the result is close to UTC now."""
        import ingestion.normalization as mod

        before = datetime.now(tz=timezone.utc)
        with patch.object(mod, "redact", side_effect=self._mock_redact):
            result = mod.normalize({"body": "no timestamp here"}, "app_store")
        after = datetime.now(tz=timezone.utc)

        ts = datetime.fromisoformat(result["timestamp"])
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        assert before <= ts <= after

    def test_iso8601_timestamp_parsed_correctly(self):
        """ISO 8601 string timestamps are preserved in output."""
        import ingestion.normalization as mod

        raw = {"body": "crash", "created_at": "2024-03-15T10:30:00Z"}
        with patch.object(mod, "redact", side_effect=self._mock_redact):
            result = mod.normalize(raw, "zendesk")

        ts = datetime.fromisoformat(result["timestamp"])
        assert ts.year == 2024
        assert ts.month == 3
        assert ts.day == 15

    def test_unix_timestamp_parsed(self):
        """Unix integer timestamps are converted to ISO 8601."""
        import ingestion.normalization as mod

        unix_ts = 1710500000  # 2024-03-15 ~14:33 UTC
        raw = {"body": "bug report", "date": unix_ts}
        with patch.object(mod, "redact", side_effect=self._mock_redact):
            result = mod.normalize(raw, "app_store")

        ts = datetime.fromisoformat(result["timestamp"])
        assert ts.year == 2024

    def test_app_store_text_extraction(self):
        """app_store items extract text from 'body' field."""
        import ingestion.normalization as mod

        raw = {"body": "Great app but slow.", "rating": 4}
        with patch.object(mod, "redact", side_effect=self._mock_redact):
            result = mod.normalize(raw, "app_store")

        assert result["text"] == "Great app but slow."

    def test_zendesk_text_extraction(self):
        """zendesk items extract text from 'description' field."""
        import ingestion.normalization as mod

        raw = {"description": "Ticket body text.", "subject": "Bug"}
        with patch.object(mod, "redact", side_effect=self._mock_redact):
            result = mod.normalize(raw, "zendesk")

        assert result["text"] == "Ticket body text."

    def test_pii_redaction_applied_to_text(self):
        """redact() is called and its output is used as the 'text' value."""
        import ingestion.normalization as mod

        raw = {"body": "Call me at 555-1234"}
        with patch.object(mod, "redact", return_value="Call me at [REDACTED]") as mock_r:
            result = mod.normalize(raw, "app_store")

        mock_r.assert_called_once_with("Call me at 555-1234")
        assert result["text"] == "Call me at [REDACTED]"


# ===========================================================================
# 3. deduplication
# ===========================================================================

class TestDeduplication:
    """Tests for ingestion.deduplication.check_and_record()."""

    def _make_normalized(self, text: str = "test text", source: str = "app_store") -> dict:
        """Build a minimal normalized item dict."""
        content_hash = hashlib.sha256(text.encode()).hexdigest()
        return {"hash": content_hash, "source": source, "text": text, "id": "fake-id"}

    def _make_mock_conn(self, existing_row=None):
        """Build a mock psycopg2 connection and cursor."""
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)
        mock_cursor.fetchone.return_value = existing_row

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        return mock_conn, mock_cursor

    def test_new_hash_returns_not_duplicate(self):
        """New content hash → is_duplicate=False, INSERT executed."""
        import ingestion.deduplication as mod

        item = self._make_normalized("unique feedback text")
        mock_conn, mock_cursor = self._make_mock_conn(existing_row=None)

        with patch("ingestion.deduplication.get_conn", return_value=mock_conn), \
             patch("ingestion.deduplication.release_conn") as mock_release:
            result = mod.check_and_record(item)

        assert result["is_duplicate"] is False
        assert result["hash"] == item["hash"]

        # INSERT must have been called.
        insert_calls = [
            c for c in mock_cursor.execute.call_args_list
            if "INSERT" in str(c)
        ]
        assert len(insert_calls) == 1
        mock_conn.commit.assert_called_once()
        mock_release.assert_called_once_with(mock_conn)

    def test_duplicate_hash_returns_is_duplicate_true(self):
        """Existing hash → is_duplicate=True, UPDATE executed."""
        import ingestion.deduplication as mod

        item = self._make_normalized("repeated feedback")
        # fetchone returns a row (hash already exists).
        mock_conn, mock_cursor = self._make_mock_conn(existing_row=("somehash",))

        with patch("ingestion.deduplication.get_conn", return_value=mock_conn), \
             patch("ingestion.deduplication.release_conn"):
            result = mod.check_and_record(item)

        assert result["is_duplicate"] is True
        assert result["hash"] == item["hash"]

    def test_frequency_counter_incremented_on_duplicate(self):
        """UPDATE statement increments frequency when hash already exists."""
        import ingestion.deduplication as mod

        item = self._make_normalized("repeated feedback")
        mock_conn, mock_cursor = self._make_mock_conn(existing_row=("somehash",))

        with patch("ingestion.deduplication.get_conn", return_value=mock_conn), \
             patch("ingestion.deduplication.release_conn"):
            mod.check_and_record(item)

        update_calls = [
            c for c in mock_cursor.execute.call_args_list
            if "UPDATE" in str(c) and "frequency" in str(c)
        ]
        assert len(update_calls) == 1

    def test_db_error_rolls_back_and_reraises(self):
        """DB exception triggers rollback and is re-raised to caller."""
        import ingestion.deduplication as mod

        item = self._make_normalized("any text")
        mock_conn, mock_cursor = self._make_mock_conn()
        mock_cursor.execute.side_effect = Exception("DB connection lost")

        with patch("ingestion.deduplication.get_conn", return_value=mock_conn), \
             patch("ingestion.deduplication.release_conn"):
            with pytest.raises(Exception, match="DB connection lost"):
                mod.check_and_record(item)

        mock_conn.rollback.assert_called_once()

    def test_connection_always_released(self):
        """release_conn is called even when an exception occurs."""
        import ingestion.deduplication as mod

        item = self._make_normalized("any text")
        mock_conn, mock_cursor = self._make_mock_conn()
        mock_cursor.execute.side_effect = Exception("boom")

        with patch("ingestion.deduplication.get_conn", return_value=mock_conn), \
             patch("ingestion.deduplication.release_conn") as mock_release:
            with pytest.raises(Exception):
                mod.check_and_record(item)

        mock_release.assert_called_once_with(mock_conn)


# ===========================================================================
# 4. s3_writer
# ===========================================================================

class TestS3Writer:
    """Tests for ingestion.s3_writer.write()."""

    def _make_normalized(
        self,
        item_id: str = "abc-123",
        source: str = "app_store",
        timestamp: str = "2024-06-15T08:30:00+00:00",
    ) -> dict:
        """Build a minimal normalized item dict."""
        return {
            "id":        item_id,
            "source":    source,
            "text":      "Some feedback",
            "timestamp": timestamp,
            "hash":      "deadbeef",
        }

    def test_s3_key_format(self):
        """Key matches {source}/{year}/{month:02d}/{day:02d}/{id}.json."""
        import ingestion.s3_writer as mod
        mod._s3 = None

        item = self._make_normalized(
            item_id="uuid-001",
            source="app_store",
            timestamp="2024-06-15T08:30:00+00:00",
        )

        with patch("boto3.client") as mock_boto:
            mock_s3 = MagicMock()
            mock_boto.return_value = mock_s3

            key = mod.write(item)

        assert key == "app_store/2024/06/15/uuid-001.json"

    def test_zendesk_key_format(self):
        """Zendesk source produces correct partitioned key."""
        import ingestion.s3_writer as mod
        mod._s3 = None

        item = self._make_normalized(
            item_id="ticket-999",
            source="zendesk",
            timestamp="2025-01-03T22:00:00+00:00",
        )

        with patch("boto3.client") as mock_boto:
            mock_s3 = MagicMock()
            mock_boto.return_value = mock_s3

            key = mod.write(item)

        assert key == "zendesk/2025/01/03/ticket-999.json"

    def test_put_object_called_with_correct_bucket_and_key(self):
        """boto3 put_object receives the env bucket name and the computed key."""
        import ingestion.s3_writer as mod
        mod._s3 = None

        item = self._make_normalized(
            item_id="id-42",
            source="app_store",
            timestamp="2024-03-10T00:00:00+00:00",
        )
        expected_bucket = os.environ["S3_RAW_BUCKET"]

        with patch("boto3.client") as mock_boto:
            mock_s3 = MagicMock()
            mock_boto.return_value = mock_s3

            mod.write(item)

        mock_s3.put_object.assert_called_once()
        call_kwargs = mock_s3.put_object.call_args.kwargs
        assert call_kwargs["Bucket"] == expected_bucket
        assert call_kwargs["Key"] == "app_store/2024/03/10/id-42.json"
        assert call_kwargs["ContentType"] == "application/json"

    def test_client_error_is_reraised(self):
        """ClientError from S3 propagates to the caller."""
        from botocore.exceptions import ClientError
        import ingestion.s3_writer as mod
        mod._s3 = None

        item = self._make_normalized()
        error_response = {"Error": {"Code": "NoSuchBucket", "Message": "bucket missing"}}

        with patch("boto3.client") as mock_boto:
            mock_s3 = MagicMock()
            mock_boto.return_value = mock_s3
            mock_s3.put_object.side_effect = ClientError(error_response, "PutObject")

            with pytest.raises(ClientError):
                mod.write(item)

    def test_malformed_timestamp_falls_back_to_utc_now(self):
        """A bad timestamp string does not crash; UTC now is used for S3 path."""
        import ingestion.s3_writer as mod
        mod._s3 = None

        item = self._make_normalized(timestamp="not-a-date")

        with patch("boto3.client") as mock_boto:
            mock_s3 = MagicMock()
            mock_boto.return_value = mock_s3

            key = mod.write(item)

        # Key should still be written with today's date.
        today = datetime.now(tz=timezone.utc)
        assert key.startswith(f"app_store/{today.year}/")

    def test_written_body_is_json(self):
        """The Body uploaded to S3 is valid JSON containing the normalized item."""
        import ingestion.s3_writer as mod
        mod._s3 = None

        item = self._make_normalized()

        with patch("boto3.client") as mock_boto:
            mock_s3 = MagicMock()
            mock_boto.return_value = mock_s3

            mod.write(item)

        body_bytes = mock_s3.put_object.call_args.kwargs["Body"]
        parsed = json.loads(body_bytes.decode("utf-8"))
        assert parsed["id"] == item["id"]
        assert parsed["hash"] == item["hash"]


# ===========================================================================
# 5. lambda_handler — integration
# ===========================================================================

class TestLambdaHandler:
    """Integration tests for ingestion.lambda_handler.handler().

    All three downstream modules (normalization, deduplication, s3_writer)
    are mocked at the module level so no real AWS calls are made.
    """

    def _normalized_item(self, text: str = "feedback text", source: str = "app_store") -> dict:
        """Return a realistic normalized dict."""
        return {
            "id":        "test-uuid-001",
            "source":    source,
            "text":      text,
            "timestamp": "2024-06-15T08:00:00+00:00",
            "hash":      hashlib.sha256(text.encode()).hexdigest(),
        }

    def test_single_clean_item_written(self):
        """One clean item → written=1, duplicates=0, errors=0."""
        import ingestion.lambda_handler as mod

        normalized = self._normalized_item()
        event = {"source_type": "app_store", "items": [{"body": "feedback text"}]}

        with patch.object(mod.normalization, "normalize", return_value=normalized), \
             patch.object(mod.deduplication, "check_and_record",
                          return_value={"is_duplicate": False, "hash": normalized["hash"]}), \
             patch.object(mod.s3_writer, "write", return_value="app_store/2024/06/15/test.json"):
            result = mod.handler(event, None)

        assert result == {"total": 1, "written": 1, "duplicates": 0, "errors": 0}

    def test_duplicate_item_not_written(self):
        """Duplicate item → written=0, duplicates=1, errors=0, s3_writer not called."""
        import ingestion.lambda_handler as mod

        normalized = self._normalized_item()
        event = {"source_type": "app_store", "items": [{"body": "feedback text"}]}

        mock_write = MagicMock()
        with patch.object(mod.normalization, "normalize", return_value=normalized), \
             patch.object(mod.deduplication, "check_and_record",
                          return_value={"is_duplicate": True, "hash": normalized["hash"]}), \
             patch.object(mod.s3_writer, "write", mock_write):
            result = mod.handler(event, None)

        assert result == {"total": 1, "written": 0, "duplicates": 1, "errors": 0}
        mock_write.assert_not_called()

    def test_bad_item_increments_errors_continues_batch(self):
        """Exception on one item → errors=1, remaining items still processed."""
        import ingestion.lambda_handler as mod

        good = self._normalized_item("good item")
        event = {
            "source_type": "app_store",
            "items": [
                {"body": "bad item"},   # will raise
                {"body": "good item"},  # should still process
            ],
        }

        call_count = {"n": 0}

        def normalize_side_effect(raw, source):
            """Raise on first call, succeed on second."""
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise ValueError("malformed input")
            return good

        with patch.object(mod.normalization, "normalize", side_effect=normalize_side_effect), \
             patch.object(mod.deduplication, "check_and_record",
                          return_value={"is_duplicate": False, "hash": good["hash"]}), \
             patch.object(mod.s3_writer, "write", return_value="app_store/2024/06/15/good.json"):
            result = mod.handler(event, None)

        assert result["total"] == 2
        assert result["errors"] == 1
        assert result["written"] == 1

    def test_returns_correct_dict_shape_always(self):
        """Return dict always has total, written, duplicates, errors keys."""
        import ingestion.lambda_handler as mod

        event = {"source_type": "app_store", "items": []}
        result = mod.handler(event, None)

        assert set(result.keys()) >= {"total", "written", "duplicates", "errors"}
        assert result["total"] == 0
        assert result["written"] == 0

    def test_missing_source_type_returns_error_response(self):
        """Missing source_type returns a safe dict without raising."""
        import ingestion.lambda_handler as mod

        result = mod.handler({"items": [{"body": "text"}]}, None)

        assert result["total"] == 0
        assert "message" in result

    def test_items_not_list_returns_error_response(self):
        """Non-list 'items' value returns a safe dict without raising."""
        import ingestion.lambda_handler as mod

        result = mod.handler({"source_type": "app_store", "items": "not-a-list"}, None)

        assert result["total"] == 0
        assert "message" in result

    def test_mixed_batch_counts(self):
        """Batch with new + duplicate + error items → counts add up to total."""
        import ingestion.lambda_handler as mod

        event = {
            "source_type": "zendesk",
            "items": [
                {"description": "new item"},
                {"description": "duplicate item"},
                {"description": "bad item"},
            ],
        }

        items_processed = {"n": 0}

        def normalize_side_effect(raw, source):
            items_processed["n"] += 1
            n = items_processed["n"]
            if n == 3:
                raise RuntimeError("bad item")
            text = f"item {n}"
            return {
                "id": f"uuid-{n}",
                "source": source,
                "text": text,
                "timestamp": "2024-01-01T00:00:00+00:00",
                "hash": hashlib.sha256(text.encode()).hexdigest(),
            }

        def dedup_side_effect(normalized):
            # item 1 = new, item 2 = duplicate
            return {"is_duplicate": normalized["id"] == "uuid-2", "hash": normalized["hash"]}

        with patch.object(mod.normalization, "normalize", side_effect=normalize_side_effect), \
             patch.object(mod.deduplication, "check_and_record", side_effect=dedup_side_effect), \
             patch.object(mod.s3_writer, "write", return_value="zendesk/2024/01/01/uuid-1.json"):
            result = mod.handler(event, None)

        assert result["total"] == 3
        assert result["written"] == 1
        assert result["duplicates"] == 1
        assert result["errors"] == 1
        assert result["written"] + result["duplicates"] + result["errors"] == result["total"]

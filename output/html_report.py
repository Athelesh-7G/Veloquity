# =============================================================
# output/html_report.py
# Generates a self-contained HTML intelligence report and
# uploads it to S3. Returns the public URL or a pre-signed URL.
# =============================================================

import json
import logging
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

_S3_KEY = "reports/latest.html"
_PRESIGN_EXPIRY = 86400  # 24 hours


def generate_and_upload(conn, s3_client, bucket_name: str) -> str:
    """Generate the HTML report and upload it to S3.

    Queries the latest reasoning run, all active evidence clusters,
    and the last 10 governance log entries. Renders a self-contained
    dark-theme HTML page and uploads to S3.

    Falls back to a pre-signed URL if public-read ACL is denied.

    Args:
        conn:        Live psycopg2 connection.
        s3_client:   Boto3 S3 client.
        bucket_name: Destination S3 bucket.

    Returns:
        Public URL or pre-signed URL string.
    """
    # 1. Latest reasoning run
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, run_at, llm_response, priority_scores, token_usage
            FROM   reasoning_runs
            ORDER  BY run_at DESC
            LIMIT  1
            """,
        )
        run_row = cur.fetchone()

    run_id = run_at = llm_response = token_usage = None
    recommendations = []
    if run_row:
        run_id, run_at, llm_response, _, token_usage_raw = run_row
        recommendations = (llm_response or {}).get("recommendations", [])
        token_usage = token_usage_raw or {}

    # 2. Active evidence clusters
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, theme, confidence_score, unique_user_count,
                   source_lineage, last_validated_at
            FROM   evidence
            WHERE  status = 'active'
            ORDER  BY confidence_score DESC
            """,
        )
        evidence_rows = cur.fetchall()

    # 3. Last 10 governance log entries
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT event_type, actioned_at, details
            FROM   governance_log
            ORDER  BY actioned_at DESC
            LIMIT  10
            """,
        )
        gov_rows = cur.fetchall()

    # 4. Build HTML
    generated_at = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    html = _render_html(
        generated_at=generated_at,
        run_id=str(run_id) if run_id else "—",
        run_at=run_at.strftime("%Y-%m-%d %H:%M UTC") if run_at else "—",
        recommendations=recommendations,
        evidence_rows=evidence_rows,
        gov_rows=gov_rows,
        token_usage=token_usage or {},
    )

    html_bytes = html.encode("utf-8")

    # 5. Upload to S3 — try public-read ACL first, fall back to pre-signed URL
    try:
        s3_client.put_object(
            Bucket=bucket_name,
            Key=_S3_KEY,
            Body=html_bytes,
            ContentType="text/html; charset=utf-8",
            ACL="public-read",
        )
        url = f"https://{bucket_name}.s3.amazonaws.com/{_S3_KEY}"
        logger.info("HTML report uploaded (public-read): %s", url)
    except ClientError as exc:
        if exc.response["Error"]["Code"] in (
            "AccessDenied", "AllAccessDisabled", "AccessControlListNotSupported"
        ):
            s3_client.put_object(
                Bucket=bucket_name,
                Key=_S3_KEY,
                Body=html_bytes,
                ContentType="text/html; charset=utf-8",
            )
            url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket_name, "Key": _S3_KEY},
                ExpiresIn=_PRESIGN_EXPIRY,
            )
            logger.info("HTML report uploaded (pre-signed URL, 24h): %s", url)
        else:
            raise

    return url


# ── private helpers ───────────────────────────────────────────

def _effort_color(effort: str) -> str:
    """Return CSS color for effort badge."""
    return {"low": "#22c55e", "medium": "#f59e0b", "high": "#ef4444"}.get(
        (effort or "").lower(), "#6b7280"
    )


def _impact_color(impact: str) -> str:
    """Return CSS color for impact badge."""
    return {"high": "#6366f1", "medium": "#8b5cf6", "low": "#a78bfa"}.get(
        (impact or "").lower(), "#6b7280"
    )


def _confidence_bar(score: float) -> str:
    """Return HTML confidence bar element."""
    pct = int(score * 100)
    if score >= 0.8:
        color = "#22c55e"
    elif score >= 0.6:
        color = "#f59e0b"
    else:
        color = "#ef4444"
    return (
        f'<div style="display:flex;align-items:center;gap:8px">'
        f'<div style="flex:1;background:#374151;border-radius:4px;height:8px">'
        f'<div style="width:{pct}%;background:{color};border-radius:4px;height:8px"></div>'
        f'</div><span style="color:{color};font-size:12px">{score:.2f}</span></div>'
    )


def _render_html(
    generated_at: str,
    run_id: str,
    run_at: str,
    recommendations: list,
    evidence_rows: list,
    gov_rows: list,
    token_usage: dict,
) -> str:
    """Render the full self-contained HTML string."""

    # ── Recommendations HTML ──────────────────────────────────
    rec_html = ""
    for rec in recommendations:
        rank = rec.get("rank", "?")
        theme = rec.get("theme", "")
        action = rec.get("recommended_action", "")
        effort = rec.get("effort_estimate", "")
        impact = rec.get("user_impact", "")
        tradeoff = rec.get("tradeoff_explanation", "")
        risks = rec.get("risk_flags") or []
        related = rec.get("related_clusters") or []

        risk_html = (
            "".join(
                f'<span style="background:#7f1d1d;color:#fca5a5;padding:2px 8px;border-radius:12px;font-size:12px">{r}</span>'
                for r in risks
            )
            if risks
            else '<span style="color:#6b7280;font-size:12px">None</span>'
        )
        related_html = (
            ", ".join(f"#{c}" for c in related) if related else "—"
        )

        rec_html += f"""
        <div style="background:#1f2937;border-radius:8px;padding:20px;margin-bottom:16px">
          <div style="display:flex;align-items:flex-start;gap:16px">
            <div style="background:#4f46e5;color:#fff;font-weight:700;font-size:18px;
                        border-radius:50%;width:36px;height:36px;display:flex;
                        align-items:center;justify-content:center;flex-shrink:0">
              {rank}
            </div>
            <div style="flex:1">
              <p style="margin:0 0 8px;font-weight:600;font-size:15px;color:#f9fafb">{_esc(theme)}</p>
              <p style="margin:0 0 12px;color:#9ca3af;font-size:14px">{_esc(action)}</p>
              <div style="display:flex;gap:8px;margin-bottom:12px">
                <span style="background:{_effort_color(effort)};color:#fff;
                             padding:2px 10px;border-radius:12px;font-size:12px">
                  Effort: {_esc(effort)}
                </span>
                <span style="background:{_impact_color(impact)};color:#fff;
                             padding:2px 10px;border-radius:12px;font-size:12px">
                  Impact: {_esc(impact)}
                </span>
              </div>
              <p style="margin:0 0 8px;color:#d1d5db;font-size:13px">
                <strong style="color:#9ca3af">Tradeoff:</strong> {_esc(tradeoff)}
              </p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                <span style="color:#6b7280;font-size:12px">Risk flags:</span>{risk_html}
              </div>
              <p style="margin:4px 0 0;color:#6b7280;font-size:12px">
                Related clusters: {related_html}
              </p>
            </div>
          </div>
        </div>"""

    if not rec_html:
        rec_html = '<p style="color:#6b7280">No recommendations available.</p>'

    # ── Evidence table HTML ───────────────────────────────────
    ev_rows_html = ""
    for ev_id, theme, conf, user_count, source_lineage, last_validated in evidence_rows:
        sources = source_lineage if isinstance(source_lineage, list) else (source_lineage or [])
        source_badges = " ".join(
            f'<span style="background:#1e3a5f;color:#93c5fd;padding:1px 7px;border-radius:10px;font-size:11px">{_esc(str(s))}</span>'
            for s in sources
        )
        validated_str = last_validated.strftime("%Y-%m-%d") if last_validated else "—"
        ev_rows_html += f"""
        <tr>
          <td style="padding:10px 12px;color:#f9fafb;font-size:13px">{_esc(theme)}</td>
          <td style="padding:10px 12px;min-width:140px">{_confidence_bar(conf or 0)}</td>
          <td style="padding:10px 12px;color:#d1d5db;text-align:center">{user_count}</td>
          <td style="padding:10px 12px">{source_badges or '<span style="color:#6b7280">—</span>'}</td>
          <td style="padding:10px 12px;color:#9ca3af;font-size:12px">{validated_str}</td>
        </tr>"""

    if not ev_rows_html:
        ev_rows_html = '<tr><td colspan="5" style="padding:16px;color:#6b7280;text-align:center">No active clusters.</td></tr>'

    # ── Governance timeline HTML ──────────────────────────────
    gov_html = ""
    event_icons = {
        "stale_flagged": ("🕐", "#7f1d1d", "#fca5a5"),
        "signal_promoted": ("⬆️", "#14532d", "#86efac"),
        "cost_alert": ("⚠️", "#78350f", "#fcd34d"),
    }
    for event_type, actioned_at, details in gov_rows:
        icon, bg, fg = event_icons.get(event_type, ("📋", "#1f2937", "#9ca3af"))
        ts = actioned_at.strftime("%Y-%m-%d %H:%M UTC") if actioned_at else "—"
        detail_text = json.dumps(details, indent=None) if details else "{}"
        gov_html += f"""
        <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">
          <span style="background:{bg};color:{fg};border-radius:50%;width:32px;height:32px;
                       display:flex;align-items:center;justify-content:center;
                       flex-shrink:0;font-size:14px">{icon}</span>
          <div>
            <p style="margin:0;color:#f9fafb;font-size:13px;font-weight:600">{_esc(event_type)}</p>
            <p style="margin:2px 0;color:#6b7280;font-size:11px">{ts}</p>
            <p style="margin:2px 0;color:#9ca3af;font-size:12px;font-family:monospace">{_esc(detail_text)}</p>
          </div>
        </div>"""

    if not gov_html:
        gov_html = '<p style="color:#6b7280">No governance activity recorded yet.</p>'

    # ── Stats ──────────────────────────────────────────────────
    tokens_in = token_usage.get("input_tokens", 0)
    tokens_out = token_usage.get("output_tokens", 0)
    ev_count = len(evidence_rows)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Veloquity Intelligence Report</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: #0f1117; color: #e5e7eb; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }}
  .container {{ max-width: 1000px; margin: 0 auto; padding: 32px 20px; }}
  h1 {{ font-size: 24px; font-weight: 700; color: #f9fafb; }}
  h2 {{ font-size: 18px; font-weight: 600; color: #e5e7eb; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #374151; }}
  .section {{ margin-bottom: 40px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ text-align: left; padding: 10px 12px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #374151; }}
  tr:hover td {{ background: #1a2233; }}
  .pill {{ display: inline-flex; align-items: center; gap: 6px; }}
  footer {{ text-align: center; color: #4b5563; font-size: 12px; margin-top: 48px; padding-top: 24px; border-top: 1px solid #1f2937; }}
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
    <div>
      <h1>Veloquity Intelligence Report</h1>
      <p style="color:#6b7280;font-size:14px;margin-top:4px">Run {_esc(run_id)} &middot; {_esc(run_at)}</p>
    </div>
    <span style="background:#4f46e5;color:#e0e7ff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600">
      Phase 4 Complete
    </span>
  </div>

  <!-- Section 1: Recommendations -->
  <div class="section">
    <h2>1 &nbsp; Prioritized Recommendations</h2>
    {rec_html}
  </div>

  <!-- Section 2: Evidence Clusters -->
  <div class="section">
    <h2>2 &nbsp; Evidence Clusters</h2>
    <div style="background:#1f2937;border-radius:8px;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Theme</th>
            <th>Confidence</th>
            <th style="text-align:center">Users</th>
            <th>Sources</th>
            <th>Last Validated</th>
          </tr>
        </thead>
        <tbody>{ev_rows_html}</tbody>
      </table>
    </div>
  </div>

  <!-- Section 3: Governance Activity -->
  <div class="section">
    <h2>3 &nbsp; Governance Activity</h2>
    <div style="background:#1f2937;border-radius:8px;padding:20px">
      {gov_html}
    </div>
  </div>

  <!-- Section 4: System Stats -->
  <div class="section">
    <h2>4 &nbsp; System Stats</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
      {_stat_card("Active Clusters", str(ev_count))}
      {_stat_card("Tokens In", f"{tokens_in:,}")}
      {_stat_card("Tokens Out", f"{tokens_out:,}")}
      {_stat_card("Report Generated", generated_at)}
    </div>
  </div>

  <footer>Generated by Veloquity &middot; {generated_at}</footer>
</div>
</body>
</html>"""


def _stat_card(label: str, value: str) -> str:
    """Return HTML for a single stat card."""
    return (
        f'<div style="background:#1f2937;border-radius:8px;padding:16px">'
        f'<p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">{_esc(label)}</p>'
        f'<p style="color:#f9fafb;font-size:22px;font-weight:700;margin-top:4px">{_esc(value)}</p>'
        f'</div>'
    )


def _esc(text: str) -> str:
    """HTML-escape a string to prevent XSS in the generated report."""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )

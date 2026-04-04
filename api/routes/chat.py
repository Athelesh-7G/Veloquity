# =============================================================
# api/routes/chat.py
# POST /api/v1/chat  — context-aware AI assistant
# =============================================================

import json
import logging

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_bedrock_client, get_db_connection
from schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
router = APIRouter()

_MODEL_ID = "us.amazon.nova-pro-v1:0"
_MAX_TOKENS = 1024


def _build_system_prompt(evidence_clusters: list, recommendations: list, governance_events: list) -> tuple[str, list[str]]:
    """Build the system prompt with live context and return context labels."""
    context_parts = []
    context_labels = []

    # Evidence clusters
    ev_lines = []
    for e in evidence_clusters:
        lineage = e.get("source_lineage") or {}
        lineage_str = " + ".join(f"{k} ({round(v*100)}%)" for k, v in lineage.items())
        ev_lines.append(
            f"  - Theme: {e['theme']} | Confidence: {e['confidence_score']:.2f} | "
            f"Users: {e['unique_user_count']} | Sources: {lineage_str}"
        )
    if ev_lines:
        context_parts.append("=== EVIDENCE CLUSTERS ===\n" + "\n".join(ev_lines))
        context_labels.append(f"{len(ev_lines)} evidence clusters")

    # Recommendations
    rec_lines = []
    for r in recommendations:
        rec_lines.append(
            f"  #{r['rank']} {r['theme']} — Action: {r['recommended_action']} "
            f"[Effort: {r['effort_estimate']}, Impact: {r['user_impact']}]"
        )
    if rec_lines:
        context_parts.append("=== LATEST RECOMMENDATIONS ===\n" + "\n".join(rec_lines))
        context_labels.append(f"{len(rec_lines)} recommendations")

    # Governance events
    gov_lines = []
    for g in governance_events:
        details_str = json.dumps(g.get("details") or {})
        gov_lines.append(
            f"  [{g['event_type']}] target={g.get('target_id', 'n/a')} details={details_str}"
        )
    if gov_lines:
        context_parts.append("=== RECENT GOVERNANCE EVENTS ===\n" + "\n".join(gov_lines))
        context_labels.append(f"{len(gov_lines)} governance events")

    system_prompt = (
        "You are Veloquity, an agentic evidence intelligence assistant. "
        "You help product managers understand their evidence clusters, "
        "recommendations, and system activity.\n\n"
        "Current system context:\n"
        + "\n\n".join(context_parts)
        + "\n\nAnswer the user's question based on this context. Be specific, "
        "cite evidence themes and recommendation ranks when relevant. "
        "If the answer cannot be found in the context, say so clearly."
    )

    return system_prompt, context_labels


@router.post("/", response_model=ChatResponse)
def chat(request: ChatRequest, conn=Depends(get_db_connection), bedrock=Depends(get_bedrock_client)):
    """Answer a product manager question using live system context."""
    # Enforce history limit
    history = request.history[-10:] if request.history else []

    # Gather context from DB
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, theme, confidence_score, unique_user_count, source_lineage
            FROM evidence WHERE status = 'active'
            ORDER BY confidence_score DESC
            """
        )
        cols = [d[0] for d in cur.description]
        evidence_clusters = [dict(zip(cols, r)) for r in cur.fetchall()]

        cur.execute(
            """
            SELECT llm_response FROM reasoning_runs
            ORDER BY run_at DESC LIMIT 1
            """
        )
        row = cur.fetchone()
        recommendations = []
        if row:
            lr = row[0]
            if isinstance(lr, str):
                lr = json.loads(lr)
            recommendations = lr.get("recommendations", [])

        cur.execute(
            """
            SELECT event_type, target_id, details, actioned_at
            FROM governance_log
            ORDER BY actioned_at DESC LIMIT 5
            """
        )
        cols = [d[0] for d in cur.description]
        governance_events = [dict(zip(cols, r)) for r in cur.fetchall()]

    for e in evidence_clusters:
        sl = e.get("source_lineage") or {}
        if isinstance(sl, str):
            try:
                e["source_lineage"] = json.loads(sl)
            except Exception:
                e["source_lineage"] = {}

    for g in governance_events:
        d = g.get("details") or {}
        if isinstance(d, str):
            try:
                g["details"] = json.loads(d)
            except Exception:
                g["details"] = {}

    system_prompt, context_labels = _build_system_prompt(
        evidence_clusters, recommendations, governance_events
    )

    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in history
    ]
    messages.append({"role": "user", "content": request.message})

    try:
        nova_messages = [
            {"role": msg["role"], "content": [{"text": msg["content"]}]}
            for msg in messages
        ]
        body = json.dumps({
            "messages": nova_messages,
            "system": [{"text": system_prompt}],
            "inferenceConfig": {
                "maxTokens": _MAX_TOKENS,
            },
        })
        response = bedrock.invoke_model(modelId=_MODEL_ID, body=body)
        result = json.loads(response["body"].read())
        reply = result["output"]["message"]["content"][0]["text"]
    except Exception as exc:
        logger.warning("Bedrock chat call failed: %s", exc)
        # Graceful fallback when Bedrock is unavailable
        reply = (
            "I'm unable to connect to the AI backend right now. "
            "This is a demo environment without live AWS credentials. "
            "In production, I would answer using your live evidence clusters and recommendations."
        )

    return ChatResponse(response=reply, context_used=context_labels)

# =============================================================
# api/routes/agents.py
# GET  /api/v1/agents/status          — status of all 4 agents
# POST /api/v1/agents/{name}/run      — invoke a specific agent
# =============================================================

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_db_connection, get_lambda_client
from schemas import AgentRunResult, AgentStatus

logger = logging.getLogger(__name__)

router = APIRouter()

_AGENT_CONFIG = {
    "ingestion": {
        "display_name": "Ingestion Agent",
        "lambda_function_name": "veloquity-ingestion-dev",
        "description": (
            "Ingests App Store and Zendesk feedback. Applies PII redaction via regex, "
            "deduplicates via SHA-256, stores to S3 with date-partitioned keys."
        ),
    },
    "evidence": {
        "display_name": "Evidence Intelligence Agent",
        "lambda_function_name": "veloquity-evidence-dev",
        "description": (
            "Embeds feedback via Bedrock Titan Embed V2 (1024 dims). "
            "Clusters semantically using greedy cosine similarity. "
            "Writes evidence with confidence scores and item-level provenance."
        ),
    },
    "reasoning": {
        "display_name": "Reasoning Agent",
        "lambda_function_name": "veloquity-reasoning-dev",
        "description": (
            "Scores evidence clusters by priority formula. Calls Bedrock Claude 3 Haiku "
            "to generate ranked, explainable product recommendations with effort and impact estimates."
        ),
    },
    "governance": {
        "display_name": "Governance Agent",
        "lambda_function_name": "veloquity-governance-dev",
        "description": (
            "Runs daily at 06:00 UTC via EventBridge. Detects stale evidence, promotes "
            "high-frequency staging signals, monitors embedding cache efficiency."
        ),
    },
}


def _fetch_agent_stats(conn, name: str) -> dict:
    """Query DB for last_run_at and total_runs for a given agent."""
    with conn.cursor() as cur:
        if name == "ingestion":
            cur.execute("SELECT MAX(first_seen) FROM dedup_index")
            row = cur.fetchone()
            last_run = row[0] if row is not None else None
            return {"last_run_at": last_run, "total_runs": None}

        if name == "evidence":
            cur.execute("SELECT MAX(last_validated_at), COUNT(*) FROM evidence")
            row = cur.fetchone()
            if row is None:
                return {"last_run_at": None, "total_runs": 0}
            return {"last_run_at": row[0], "total_runs": int(row[1])}

        if name == "reasoning":
            cur.execute("SELECT MAX(run_at), COUNT(*) FROM reasoning_runs")
            row = cur.fetchone()
            if row is None:
                return {"last_run_at": None, "total_runs": 0}
            return {"last_run_at": row[0], "total_runs": int(row[1])}

        if name == "governance":
            cur.execute("SELECT MAX(actioned_at), COUNT(*) FROM governance_log")
            row = cur.fetchone()
            if row is None:
                return {"last_run_at": None, "total_runs": 0}
            return {"last_run_at": row[0], "total_runs": int(row[1])}

    return {"last_run_at": None, "total_runs": None}


@router.get("/status", response_model=list[AgentStatus])
def get_agent_status(conn=Depends(get_db_connection)):
    """Return status information for all 4 agents."""
    statuses = []
    for name, cfg in _AGENT_CONFIG.items():
        stats = _fetch_agent_stats(conn, name)
        statuses.append(
            AgentStatus(
                name=name,
                display_name=cfg["display_name"],
                last_run_at=stats["last_run_at"],
                last_run_status="idle",
                total_runs=stats["total_runs"],
                description=cfg["description"],
                lambda_function_name=cfg["lambda_function_name"],
            )
        )
    return statuses


@router.post("/{agent_name}/run", response_model=AgentRunResult)
def run_agent(agent_name: str, lambda_client=Depends(get_lambda_client)):
    """Invoke a specific agent Lambda synchronously."""
    if agent_name not in _AGENT_CONFIG:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown agent '{agent_name}'. Must be one of: {list(_AGENT_CONFIG.keys())}",
        )

    function_name = _AGENT_CONFIG[agent_name]["lambda_function_name"]
    invoked_at = datetime.now(tz=timezone.utc)

    try:
        response = lambda_client.invoke(
            FunctionName=function_name,
            InvocationType="RequestResponse",
            Payload=json.dumps({"trigger": "api", "source": "veloquity-ui"}),
        )
        payload_bytes = response["Payload"].read()
        payload = json.loads(payload_bytes)

        if response.get("FunctionError"):
            raise HTTPException(
                status_code=500,
                detail=f"Lambda function error: {payload}",
            )

        return AgentRunResult(
            agent_name=agent_name,
            status="success",
            response_payload=payload if isinstance(payload, dict) else {"raw": str(payload)},
            invoked_at=invoked_at,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Lambda invoke failed for agent=%s: %s", agent_name, exc)
        raise HTTPException(status_code=500, detail=str(exc))

# =============================================================
# evidence/threshold.py
# Route clusters to accept/reject/ambiguous based on confidence,
# with LLM validation for ambiguous cases.
# =============================================================

import json
import logging
import os
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from evidence.confidence import classify_confidence

logger = logging.getLogger(__name__)

_bedrock = None


def _get_bedrock():
    """Return a cached Bedrock Runtime client."""
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client(
            "bedrock-runtime", region_name=os.environ["AWS_REGION_NAME"]
        )
    return _bedrock


# ---------------------------------------------------------------------------
# LLM validation (ambiguous path only)
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are a product feedback analyst. Determine if the "
    "following group of feedback items represents a real, "
    "distinct product signal worth investigating. "
    "Respond with JSON only, no markdown, no explanation: "
    "{\"is_signal\": true or false, \"reason\": \"one sentence\"}"
)


def validate_with_llm(cluster: dict[str, Any]) -> dict[str, Any]:
    """Ask Bedrock Claude to decide whether an ambiguous cluster is a real signal.

    Builds a numbered list of up to 5 representative texts from the cluster
    and sends it to the configured LLM. Parses the JSON response to extract
    'is_signal' and 'reason'. On any error (API failure, malformed JSON,
    missing keys) logs the failure and returns a safe reject decision so the
    caller is never left with an unrouted cluster.

    Args:
        cluster: Cluster dict with at least an 'items' list where each item
                 has a 'text' key.

    Returns:
        Dict with keys:
            decision (str): "accept" or "reject"
            reason   (str): one-sentence explanation from the LLM, or
                            "llm_validation_failed" on error.
    """
    model_id = os.environ["BEDROCK_LLM_MODEL"]

    # Build user prompt: numbered list of up to 5 texts.
    items = cluster.get("items", [])
    sample_texts = [
        item.get("text", "").strip()
        for item in items[:5]
        if item.get("text", "").strip()
    ]
    if not sample_texts:
        logger.warning(
            "validate_with_llm called with cluster %s that has no text; rejecting.",
            cluster.get("cluster_id"),
        )
        return {"decision": "reject", "reason": "llm_validation_failed"}

    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(sample_texts))
    user_prompt = f"Feedback items:\n{numbered}"

    # Bedrock Claude Messages API payload.
    payload = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 256,
        "system": _SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": user_prompt}
        ],
    })

    try:
        response = _get_bedrock().invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=payload,
        )
        body = json.loads(response["body"].read())

        # Claude returns content as a list of content blocks.
        content_blocks = body.get("content", [])
        raw_text = ""
        for block in content_blocks:
            if block.get("type") == "text":
                raw_text = block.get("text", "")
                break

        if not raw_text:
            raise ValueError(f"No text content block in Bedrock response: {body}")

        parsed = json.loads(raw_text)
        is_signal = bool(parsed.get("is_signal", False))
        reason = str(parsed.get("reason", ""))

    except (BotoCoreError, ClientError) as exc:
        logger.error(
            "Bedrock LLM call failed for cluster %s: %s",
            cluster.get("cluster_id"), exc,
        )
        return {"decision": "reject", "reason": "llm_validation_failed"}
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        logger.error(
            "LLM response parse failed for cluster %s: %s",
            cluster.get("cluster_id"), exc,
        )
        return {"decision": "reject", "reason": "llm_validation_failed"}
    except Exception as exc:
        logger.error(
            "Unexpected error in validate_with_llm for cluster %s: %s",
            cluster.get("cluster_id"), exc, exc_info=True,
        )
        return {"decision": "reject", "reason": "llm_validation_failed"}

    decision = "accept" if is_signal else "reject"
    logger.info(
        "LLM validation: cluster=%s decision=%s reason=%s",
        cluster.get("cluster_id"), decision, reason,
    )
    return {"decision": decision, "reason": reason}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate_cluster(cluster: dict[str, Any], confidence_score: float) -> dict[str, Any]:
    """Route a cluster to accept, reject, or LLM validation based on confidence.

    Decision matrix:
        "accept"    (score >= CONFIDENCE_AUTO_ACCEPT):
            Cluster is tight enough to accept immediately. No LLM call.
        "reject"    (score < CONFIDENCE_AUTO_REJECT):
            Cluster is too diffuse. Discarded without LLM call.
        "ambiguous" (CONFIDENCE_AUTO_REJECT <= score < CONFIDENCE_AUTO_ACCEPT):
            Borderline cluster. Delegated to validate_with_llm().

    Args:
        cluster:          Cluster dict from cluster_embeddings().
        confidence_score: Float in [0.0, 1.0] from compute_confidence().

    Returns:
        Dict with keys:
            decision         (str):        "accept" or "reject"
            cluster          (dict):       the input cluster, unmodified
            confidence_score (float):      the input score
            reason           (str | None): None for auto-decisions,
                                           LLM sentence for ambiguous path
    """
    classification = classify_confidence(confidence_score)

    if classification == "accept":
        logger.info(
            "evaluate_cluster: cluster=%s score=%.4f -> AUTO ACCEPT",
            cluster.get("cluster_id"), confidence_score,
        )
        return {
            "decision":         "accept",
            "cluster":          cluster,
            "confidence_score": confidence_score,
            "reason":           None,
        }

    if classification == "reject":
        logger.info(
            "evaluate_cluster: cluster=%s score=%.4f -> AUTO REJECT",
            cluster.get("cluster_id"), confidence_score,
        )
        return {
            "decision":         "reject",
            "cluster":          cluster,
            "confidence_score": confidence_score,
            "reason":           None,
        }

    # Ambiguous — delegate to LLM.
    logger.info(
        "evaluate_cluster: cluster=%s score=%.4f -> AMBIGUOUS, calling LLM",
        cluster.get("cluster_id"), confidence_score,
    )
    llm_result = validate_with_llm(cluster)
    return {
        "decision":         llm_result["decision"],
        "cluster":          cluster,
        "confidence_score": confidence_score,
        "reason":           llm_result.get("reason"),
    }

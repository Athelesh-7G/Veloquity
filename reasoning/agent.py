# =============================================================
# reasoning/agent.py
# ReAct-style Reasoning Agent entry point.
# Orchestrates retrieval → scoring → prompting → Bedrock → output.
# =============================================================

import json
import logging

from reasoning.retriever import fetch_active_evidence
from reasoning.scorer import compute_priority_scores
from reasoning.prompt_builder import build_prompt
from reasoning.output_writer import write_results

logger = logging.getLogger(__name__)

# Bedrock DeepSeek model
_MODEL_ID = "deepseek.v3.2"
_MAX_TOKENS = 2000


def run_reasoning_agent(conn, bedrock_client, s3_client, bucket_name: str) -> dict:
    """Orchestrate the full Reasoning Agent pipeline."""

    # ---------------------------------------------------------
    # 1. Retrieve evidence
    # ---------------------------------------------------------
    evidence_list = fetch_active_evidence(conn)

    if not evidence_list:
        raise ValueError("No active evidence found — run Phase 2 pipeline first.")

    # ---------------------------------------------------------
    # 2. Score clusters
    # ---------------------------------------------------------
    scored_evidence = compute_priority_scores(evidence_list)

    # ---------------------------------------------------------
    # 3. Build prompt
    # ---------------------------------------------------------
    prompt = build_prompt(scored_evidence)

    # ---------------------------------------------------------
    # 4. Call Bedrock (DeepSeek V3.2)
    # ---------------------------------------------------------
    payload = {
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": _MAX_TOKENS,
        "temperature": 0.2
    }

    logger.info(
        "Invoking Bedrock model=%s max_tokens=%d",
        _MODEL_ID,
        _MAX_TOKENS
    )

    try:
        response = bedrock_client.invoke_model(
            modelId=_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(payload)
        )

        raw_body = json.loads(response["body"].read())

    except Exception as exc:
        logger.error("Bedrock InvokeModel failed: %s", exc)
        raise

    # ---------------------------------------------------------
    # 5. Extract LLM text output
    # ---------------------------------------------------------
    try:
        llm_text = raw_body["output"]["message"]["content"][0]["text"]

    except (KeyError, IndexError) as exc:
        logger.error("Unexpected Bedrock response structure: %s", raw_body)
        raise ValueError(
            f"Bedrock response missing expected output.message.content field: {exc}"
        ) from exc

    # ---------------------------------------------------------
    # 6. Parse JSON from LLM text
    # ---------------------------------------------------------
    try:
        llm_response = json.loads(llm_text)

    except json.JSONDecodeError as exc:
        logger.error("Bedrock returned non-JSON text: %s", llm_text)

        raise ValueError(
            f"Bedrock returned malformed JSON (offset {exc.pos}): {llm_text[:200]!r}"
        ) from exc

    # ---------------------------------------------------------
    # 7. Token usage
    # ---------------------------------------------------------
    usage = raw_body.get("usage", {})

    token_usage = {
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0)
    }

    # ---------------------------------------------------------
    # 8. Prepare result payload
    # ---------------------------------------------------------
    evidence_ids = [ev["id"] for ev in scored_evidence]

    priority_scores_payload = [
        {k: v for k, v in ev.items() if k != "embedding_vector"}
        for ev in scored_evidence
    ]

    # ---------------------------------------------------------
    # 9. Persist results
    # ---------------------------------------------------------
    run_id = write_results(
        conn=conn,
        s3_client=s3_client,
        bucket_name=bucket_name,
        evidence_ids=evidence_ids,
        priority_scores=priority_scores_payload,
        llm_response=llm_response,
        token_usage=token_usage,
        model_id=_MODEL_ID,
    )

    s3_report_key = f"reasoning-runs/{run_id}.json"

    logger.info(
        "run_reasoning_agent complete: run_id=%s evidence=%d recommendations=%d "
        "tokens_in=%d tokens_out=%d",
        run_id,
        len(evidence_list),
        len(llm_response.get("recommendations", [])),
        token_usage["input_tokens"],
        token_usage["output_tokens"],
    )

    # ---------------------------------------------------------
    # 10. Return API response
    # ---------------------------------------------------------
    return {
        "run_id": run_id,
        "evidence_count": len(evidence_list),
        "recommendations": llm_response.get("recommendations", []),
        "meta": llm_response.get("meta", {}),
        "token_usage": token_usage,
        "s3_report_key": s3_report_key,
    }

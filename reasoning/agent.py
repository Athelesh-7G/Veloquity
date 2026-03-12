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

_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"
_MAX_TOKENS = 2000


def run_reasoning_agent(conn, bedrock_client, s3_client, bucket_name: str) -> dict:
    """Orchestrate the full Reasoning Agent pipeline.

    Steps:
        1. Retrieve active evidence clusters from DB.
        2. Score and rank clusters by priority.
        3. Build LLM prompt from ranked clusters.
        4. Call Bedrock (Claude Sonnet) with the prompt.
        5. Parse the structured JSON response.
        6. Persist results to DB and S3.
        7. Return structured result dict.

    Args:
        conn:           Live psycopg2 connection.
        bedrock_client: Boto3 bedrock-runtime client.
        s3_client:      Boto3 S3 client.
        bucket_name:    S3 bucket for reports.

    Returns:
        Dict with keys:
            run_id, evidence_count, recommendations (list),
            meta (dict), token_usage (dict), s3_report_key.

    Raises:
        ValueError: If no active evidence is found or Bedrock returns
                    unparseable JSON.
        Exception:  Re-raises any unexpected error from sub-components.
    """
    # 1. Retrieve
    evidence_list = fetch_active_evidence(conn)
    if not evidence_list:
        raise ValueError("No active evidence found — run Phase 2 pipeline first.")

    # 2. Score
    scored_evidence = compute_priority_scores(evidence_list)

    # 3. Prompt
    prompt = build_prompt(scored_evidence)

    # 4. Call Bedrock
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": _MAX_TOKENS,
        "messages": [{"role": "user", "content": prompt}],
    })

    logger.info("Invoking Bedrock model=%s max_tokens=%d", _MODEL_ID, _MAX_TOKENS)
    try:
        response = bedrock_client.invoke_model(
            modelId=_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        raw_body = json.loads(response["body"].read())
    except Exception as exc:
        logger.error("Bedrock InvokeModel failed: %s", exc)
        raise

    # 5. Parse JSON from LLM text output
    try:
        llm_text = raw_body["content"][0]["text"]
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected Bedrock response structure: %s", raw_body)
        raise ValueError(f"Bedrock response missing expected content field: {exc}") from exc

    try:
        llm_response = json.loads(llm_text)
    except json.JSONDecodeError as exc:
        logger.error("Bedrock returned non-JSON text: %s", llm_text)
        raise ValueError(
            f"Bedrock returned malformed JSON (offset {exc.pos}): {llm_text[:200]!r}"
        ) from exc

    usage = raw_body.get("usage", {})
    token_usage = {
        "input_tokens":  usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
    }

    # 6. Write results
    evidence_ids = [ev["id"] for ev in scored_evidence]
    priority_scores_payload = [
        {k: v for k, v in ev.items() if k != "embedding_vector"}
        for ev in scored_evidence
    ]

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
        run_id, len(evidence_list),
        len(llm_response.get("recommendations", [])),
        token_usage["input_tokens"], token_usage["output_tokens"],
    )

    # 7. Return
    return {
        "run_id":          run_id,
        "evidence_count":  len(evidence_list),
        "recommendations": llm_response.get("recommendations", []),
        "meta":            llm_response.get("meta", {}),
        "token_usage":     token_usage,
        "s3_report_key":   s3_report_key,
    }

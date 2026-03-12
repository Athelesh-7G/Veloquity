# =============================================================
# reasoning/prompt_builder.py
# Build the Bedrock prompt for the Reasoning Agent.
# =============================================================

import json
import logging

logger = logging.getLogger(__name__)

_JSON_SCHEMA = """{
  "recommendations": [
    {
      "rank": 1,
      "theme": "...",
      "recommended_action": "...",
      "effort_estimate": "low|medium|high",
      "user_impact": "low|medium|high",
      "tradeoff_explanation": "...",
      "risk_flags": ["..."],
      "related_clusters": []
    }
  ],
  "meta": {
    "reasoning_summary": "...",
    "highest_priority_theme": "...",
    "cross_cluster_insight": "..."
  }
}"""


def _format_lineage(source_lineage: dict) -> str:
    """Format source_lineage dict as a human-readable string.

    Args:
        source_lineage: e.g. {"app_store": 0.5, "zendesk": 0.5}

    Returns:
        e.g. "app_store (50%) + zendesk (50%)"
    """
    if not source_lineage:
        return "unknown"
    parts = [f"{src} ({round(pct * 100)}%)" for src, pct in source_lineage.items()]
    return " + ".join(parts)


def build_prompt(scored_evidence: list[dict]) -> str:
    """Build the LLM prompt from ranked, scored evidence clusters.

    Each cluster is rendered as a numbered entry with all scoring
    dimensions visible so the model can explain its reasoning.
    The model is instructed to return only valid JSON matching the
    exact schema defined in _JSON_SCHEMA.

    Args:
        scored_evidence: Output of compute_priority_scores() — list of
                         evidence dicts sorted descending by priority_score.

    Returns:
        Prompt string ready to send to Bedrock InvokeModel.
    """
    cluster_lines = []
    for rank, ev in enumerate(scored_evidence, start=1):
        lineage_str = _format_lineage(ev.get("source_lineage") or {})
        cluster_lines.append(
            f"Cluster #{rank}\n"
            f"  Theme              : {ev['theme']}\n"
            f"  Priority Score     : {ev['priority_score']:.4f}\n"
            f"  Confidence Score   : {ev['confidence_score']:.4f}\n"
            f"  Unique User Count  : {ev['unique_user_count']}\n"
            f"  Source Lineage     : {lineage_str}\n"
            f"  Recency Score      : {ev['recency_score']:.4f}\n"
        )

    clusters_block = "\n".join(cluster_lines)

    prompt = (
        "You are a product intelligence agent reasoning over confirmed user feedback evidence.\n"
        "The evidence below has been extracted from real user feedback, semantically clustered,\n"
        "and scored for priority using confidence, user volume, source diversity, and recency.\n\n"
        "Your task: produce ranked product recommendations that a PM can act on immediately.\n\n"
        "=== EVIDENCE CLUSTERS (ranked by priority) ===\n\n"
        f"{clusters_block}\n"
        "=== INSTRUCTIONS ===\n\n"
        "Return ONLY a valid JSON object. No markdown. No preamble. No explanation outside the JSON.\n"
        "The JSON must exactly match this schema:\n\n"
        f"{_JSON_SCHEMA}\n\n"
        "Rules:\n"
        "- rank: integer matching the cluster number above\n"
        "- recommended_action: specific, concrete action (not vague)\n"
        "- effort_estimate: one of 'low', 'medium', 'high'\n"
        "- user_impact: one of 'low', 'medium', 'high'\n"
        "- tradeoff_explanation: what is gained vs what is risked or delayed\n"
        "- risk_flags: list of strings; empty list [] if none\n"
        "- related_clusters: list of rank integers for clusters that share a root cause\n"
        "- reasoning_summary: 2-3 sentences synthesising the overall signal across clusters\n"
        "- cross_cluster_insight: one pattern or root cause that spans multiple clusters\n\n"
        "Return only the JSON object now."
    )

    logger.info("build_prompt: %d clusters, prompt length=%d chars", len(scored_evidence), len(prompt))
    return prompt

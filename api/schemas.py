# =============================================================
# api/schemas.py
# Pydantic v2 response models for all API routes.
# =============================================================

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel


class EvidenceItem(BaseModel):
    id: str
    theme: str
    confidence_score: float
    unique_user_count: int
    source_lineage: dict[str, Any]
    representative_quotes: list[dict[str, Any]]
    status: str
    last_validated_at: Optional[datetime]


class EvidenceMapItem(BaseModel):
    id: str
    dedup_hash: str
    s3_key: str
    source: str
    item_id: str
    item_timestamp: Optional[datetime]


class Recommendation(BaseModel):
    rank: int
    theme: str
    recommended_action: str
    effort_estimate: str
    user_impact: str
    tradeoff_explanation: str
    risk_flags: list[str]
    related_clusters: list[int]


class ReasoningRun(BaseModel):
    model_config = {"protected_namespaces": ()}

    id: str
    run_at: datetime
    model_id: str
    token_usage: dict[str, Any]
    recommendations: list[Recommendation]
    reasoning_summary: str
    highest_priority_theme: str
    cross_cluster_insight: str


class AgentStatus(BaseModel):
    name: str
    display_name: str
    last_run_at: Optional[datetime]
    last_run_status: str
    total_runs: Optional[int]
    description: str
    lambda_function_name: str


class AgentRunResult(BaseModel):
    agent_name: str
    status: str
    response_payload: dict[str, Any]
    invoked_at: datetime


class GovernanceEvent(BaseModel):
    id: str
    event_type: str
    target_id: Optional[str]
    details: dict[str, Any]
    actioned_at: datetime


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

    model_config = {"json_schema_extra": {"examples": [{"message": "What are the top issues?", "history": []}]}}


class ChatResponse(BaseModel):
    response: str
    context_used: list[str]

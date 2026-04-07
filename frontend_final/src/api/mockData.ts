export const MOCK_EVIDENCE = [
  {
    id: "ev-001",
    theme: "Mobile App Performance Degradation",
    confidence: 0.91,
    user_count: 247,
    source_distribution: { app_store: 68, zendesk: 32 },
    representative_quotes: [
      { text: "App crashes every time I try to load my dashboard on iPhone 14", source: "App Store" },
      { text: "Mobile performance has gotten significantly worse since the last update", source: "Zendesk" },
      { text: "Loading times are 8-12 seconds on mobile, completely unusable", source: "App Store" }
    ],
    status: "active",
    created_at: "2026-02-15T10:00:00Z"
  },
  {
    id: "ev-002",
    theme: "Dark Mode Feature Request",
    confidence: 0.87,
    user_count: 189,
    source_distribution: { app_store: 45, zendesk: 55 },
    representative_quotes: [
      { text: "Please add dark mode, my eyes hurt using this at night", source: "App Store" },
      { text: "Dark mode is the most requested feature in our team survey", source: "Zendesk" },
      { text: "Every competitor has dark mode, we need this to stay competitive", source: "App Store" }
    ],
    status: "active",
    created_at: "2026-02-18T14:00:00Z"
  },
  {
    id: "ev-003",
    theme: "Data Export Reliability Issues",
    confidence: 0.78,
    user_count: 134,
    source_distribution: { app_store: 20, zendesk: 80 },
    representative_quotes: [
      { text: "CSV export fails silently when date range exceeds 30 days", source: "Zendesk" },
      { text: "Export button does nothing on Firefox, works on Chrome", source: "Zendesk" },
      { text: "Lost 2 hours of work because export corrupted my data", source: "Zendesk" }
    ],
    status: "active",
    created_at: "2026-02-20T09:00:00Z"
  },
  {
    id: "ev-004",
    theme: "Enterprise SSO Integration Demand",
    confidence: 0.82,
    user_count: 98,
    source_distribution: { app_store: 10, zendesk: 90 },
    representative_quotes: [
      { text: "Our security team requires SSO before we can expand our license", source: "Zendesk" },
      { text: "SAML integration is blocking our enterprise rollout", source: "Zendesk" },
      { text: "Okta support is non-negotiable for us", source: "Zendesk" }
    ],
    status: "active",
    created_at: "2026-02-22T11:00:00Z"
  }
]

export const MOCK_RECOMMENDATIONS = {
  run_id: "run-demo-001",
  created_at: "2026-03-10T06:00:00Z",
  model_id: "us.amazon.nova-pro-v1:0",
  reasoning_summary: "Analysis of 668 feedback signals across 4 evidence clusters reveals mobile performance as the highest-priority issue affecting user retention. Dark mode and export reliability are quick wins with high user satisfaction potential. Enterprise SSO represents a revenue-critical blocker for expansion accounts.",
  cross_cluster_insight: "Mobile performance issues correlate strongly with enterprise churn signals in Zendesk data, suggesting the performance problem disproportionately affects high-value accounts.",
  recommendations: [
    {
      rank: 1,
      theme: "Mobile App Performance Degradation",
      action: "Immediate mobile performance audit and optimization sprint targeting iOS 14+ load time reduction to under 2 seconds",
      effort: "high",
      impact: "high",
      confidence: 0.91,
      tradeoff: "High engineering cost but directly addresses 37% of total feedback volume and likely top driver of mobile churn",
      risk_flags: ["Requires native mobile expertise", "May need infrastructure changes"],
      related_clusters: ["ev-001"]
    },
    {
      rank: 2,
      theme: "Dark Mode Feature Request",
      action: "Ship dark mode toggle using CSS custom properties — estimated 2-3 sprint effort with high user satisfaction return",
      effort: "medium",
      impact: "high",
      confidence: 0.87,
      tradeoff: "Moderate effort, strong brand signal. 189 users requested explicitly, actual demand likely 3-5x higher.",
      risk_flags: ["Design system audit required"],
      related_clusters: ["ev-002"]
    },
    {
      rank: 3,
      theme: "Data Export Reliability Issues",
      action: "Fix CSV export pagination bug and add async export with email delivery for large date ranges",
      effort: "low",
      impact: "medium",
      confidence: 0.78,
      tradeoff: "Low effort fix with immediate trust recovery for power users. 80% of signals from enterprise Zendesk.",
      risk_flags: ["Async infrastructure needed for large exports"],
      related_clusters: ["ev-003"]
    },
    {
      rank: 4,
      theme: "Enterprise SSO Integration Demand",
      action: "Implement SAML 2.0 with Okta as primary provider to unblock enterprise license expansion",
      effort: "high",
      impact: "high",
      confidence: 0.82,
      tradeoff: "High effort but revenue-critical. Multiple enterprise accounts explicitly blocked on this feature.",
      risk_flags: ["Security review required", "Compliance implications"],
      related_clusters: ["ev-004"]
    }
  ]
}

export const MOCK_AGENTS = [
  {
    name: "ingestion",
    display_name: "Ingestion Agent",
    description: "Ingests App Store reviews and Zendesk tickets. Applies PII redaction and SHA-256 deduplication before landing to S3.",
    last_run_status: "success",
    last_run_at: "2026-03-10T06:02:00Z",
    total_runs: 47,
    lambda_function_name: "veloquity-ingestion-dev"
  },
  {
    name: "evidence",
    display_name: "Evidence Intelligence",
    description: "Embeds feedback using Amazon Titan Embed V2 (1024 dims), caches in pgvector RDS, clusters with cosine similarity at 0.6 threshold.",
    last_run_status: "success",
    last_run_at: "2026-03-10T06:08:00Z",
    total_runs: 43,
    lambda_function_name: "veloquity-evidence-dev"
  },
  {
    name: "reasoning",
    display_name: "Reasoning Agent",
    description: "Scores evidence clusters on confidence, user count, source corroboration and recency. Invokes Amazon Nova Pro for structured recommendations.",
    last_run_status: "success",
    last_run_at: "2026-03-10T06:15:00Z",
    total_runs: 38,
    lambda_function_name: "veloquity-reasoning-dev"
  },
  {
    name: "governance",
    display_name: "Governance Agent",
    description: "Runs daily at 06:00 UTC via EventBridge. Detects stale signals, promotes high-frequency evidence, monitors embedding cache rate.",
    last_run_status: "success",
    last_run_at: "2026-03-10T06:00:00Z",
    total_runs: 52,
    lambda_function_name: "veloquity-governance-dev"
  }
]

export const MOCK_GOVERNANCE = [
  {
    id: "g-001",
    event_type: "signal_promoted",
    details: { theme: "Mobile App Performance Degradation", user_count: 247, reason: "frequency>=10 threshold met" },
    actioned_at: "2026-03-10T06:00:45Z"
  },
  {
    id: "g-002",
    event_type: "stale_flagged",
    details: { evidence_id: "ev-legacy-003", days_inactive: 34, action: "flagged for review" },
    actioned_at: "2026-03-10T06:00:52Z"
  },
  {
    id: "g-003",
    event_type: "cache_rate_alert",
    details: { cache_hit_rate: 0.67, threshold: 0.70, recommendation: "Consider expanding embedding cache TTL" },
    actioned_at: "2026-03-10T06:01:03Z"
  },
  {
    id: "g-004",
    event_type: "signal_promoted",
    details: { theme: "Dark Mode Feature Request", user_count: 189, reason: "frequency>=10 threshold met" },
    actioned_at: "2026-03-09T06:01:12Z"
  },
  {
    id: "g-005",
    event_type: "stale_flagged",
    details: { evidence_id: "ev-legacy-001", days_inactive: 31, action: "flagged for review" },
    actioned_at: "2026-03-09T06:01:18Z"
  }
]

export const MOCK_STATS = {
  total: 5,
  last_24h: 3,
  last_7d: 5,
  events_by_type: {
    signal_promoted: 2,
    stale_flagged: 2,
    cache_rate_alert: 1
  },
  active_evidence: 4,
  staging_count: 0
}

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

// ─── Hospital Dataset ──────────────────────────────────────────────────────────

export const HOSPITAL_MOCK_DATA = [
  {
    id: "hev-001",
    theme: "Extended Emergency Wait Times",
    confidence_score: 0.91,
    unique_user_count: 87,
    feedback_item_count: 98,
    source_lineage: ["patient_portal", "hospital_survey"],
    status: "active",
    trend: "increasing",
    representative_quotes: [
      "Waited 4 hours in the ER with chest pain before anyone saw me",
      "Emergency department wait times have doubled in the past year",
      "Triage nurses were kind but the system is clearly overwhelmed",
      "My elderly mother waited 5 hours on a hard chair — unacceptable"
    ]
  },
  {
    id: "hev-002",
    theme: "Online Appointment Booking Failures",
    confidence_score: 0.84,
    unique_user_count: 71,
    feedback_item_count: 76,
    source_lineage: ["patient_portal", "hospital_survey"],
    status: "active",
    trend: "stable",
    representative_quotes: [
      "Booking portal crashes every time I try to confirm my appointment",
      "Got double-booked through the online system — twice in one month",
      "No confirmation email after booking. Never know if it went through",
      "The portal times out and loses all my entered insurance information"
    ]
  },
  {
    id: "hev-003",
    theme: "Billing Statement Errors and Confusion",
    confidence_score: 0.78,
    unique_user_count: 58,
    feedback_item_count: 82,
    source_lineage: ["hospital_survey"],
    status: "active",
    trend: "stable",
    representative_quotes: [
      "Received a bill for a service I never received. Dispute ignored.",
      "Insurance was not applied to my bill despite being pre-approved",
      "Two different bills arrived for the same hospital stay",
      "Charged at inpatient rates for an outpatient day procedure"
    ]
  },
  {
    id: "hev-004",
    theme: "Medical Records Portal Access Issues",
    confidence_score: 0.72,
    unique_user_count: 44,
    feedback_item_count: 54,
    source_lineage: ["patient_portal"],
    status: "active",
    trend: "decreasing",
    representative_quotes: [
      "Cannot log into MyChart. Reset password three times. Still locked out.",
      "Test results were supposed to be in the portal within 48 hours. Still missing after 2 weeks.",
      "The portal app crashes immediately on Android. Web version barely works.",
      "My medication list in the portal is completely wrong — two discontinued meds still showing"
    ]
  }
]

export const HOSPITAL_MOCK_RECOMMENDATIONS = [
  {
    id: "hrec-001",
    priority_rank: 1,
    theme: "Extended Emergency Wait Times",
    recommendation: "Deploy real-time ER wait time display in patient portal and SMS updates every 30 minutes for waiting patients. Partner with operations team to audit triage flow and identify bottlenecks causing the observed doubling of wait times.",
    confidence: 0.91,
    affected_users: 87,
    risk_level: "high",
    effort_level: "high",
    reasoning: "Highest-confidence cluster with 98 feedback items. Wait time issues directly impact patient safety and satisfaction. Rising trend indicates the problem is worsening. Cross-source corroboration from both portal reviews and survey tickets confirms this is systemic, not isolated."
  },
  {
    id: "hrec-002",
    priority_rank: 2,
    theme: "Online Appointment Booking Failures",
    recommendation: "Immediate portal stability audit focusing on session timeout handling and insurance data persistence. Implement booking confirmation SMS as fallback. Add duplicate-booking detection before confirmation to prevent double-booking.",
    confidence: 0.84,
    affected_users: 71,
    risk_level: "medium",
    effort_level: "medium",
    reasoning: "76 feedback items with stable trend. Portal crashes and double-booking directly erode patient trust and increase no-show rates. Confirmation failures leave patients uncertain about their care schedule. Medium effort fix with high patient satisfaction return."
  },
  {
    id: "hrec-003",
    priority_rank: 3,
    theme: "Billing Statement Errors and Confusion",
    recommendation: "Audit billing system integration with insurance pre-authorization workflow. Implement itemized bill reconciliation check before dispatch. Create a patient-facing bill dispute portal with guaranteed 48-hour acknowledgement SLA.",
    confidence: 0.78,
    affected_users: 58,
    risk_level: "medium",
    effort_level: "medium",
    reasoning: "82 feedback items, predominantly from hospital survey. Billing errors create financial harm and legal risk. Insurance pre-approval mismatches suggest an integration gap. Single-source signal (hospital survey only) reduces confidence slightly but the severity of impacts demands action."
  },
  {
    id: "hrec-004",
    priority_rank: 4,
    theme: "Medical Records Portal Access Issues",
    recommendation: "Fix MyChart Android crash (likely WebView compatibility issue) and reduce password reset friction with biometric fallback. Implement automated 48-hour test result delivery SLA with notification if delayed. Audit medication reconciliation data sync.",
    confidence: 0.72,
    affected_users: 44,
    risk_level: "low",
    effort_level: "low",
    reasoning: "54 feedback items with decreasing trend — likely partially addressed already. Android crash and password lockout are discrete engineering fixes. Decreasing trend and single-source signal (patient portal only) lower urgency relative to other clusters, but access failures directly impair continuity of care."
  }
]

export const HOSPITAL_MOCK_AGENTS = [
  {
    name: "ingestion",
    display_name: "Ingestion Agent",
    description: "Ingests Patient Portal reviews and Hospital Survey tickets. Applies PII redaction (names, DOB, MRN) and SHA-256 deduplication before landing 310 patient feedback items to S3.",
    last_run_status: "success",
    last_run_at: "2026-03-15T06:02:00Z",
    total_runs: 12,
    lambda_function_name: "veloquity-ingestion-dev"
  },
  {
    name: "evidence",
    display_name: "Evidence Intelligence",
    description: "Embeds 310 patient feedback items using Amazon Titan Embed V2 (1024 dims), caches in pgvector RDS, clusters with cosine similarity at 0.6 threshold into 4 evidence clusters.",
    last_run_status: "success",
    last_run_at: "2026-03-15T06:08:00Z",
    total_runs: 11,
    lambda_function_name: "veloquity-evidence-dev"
  },
  {
    name: "reasoning",
    display_name: "Reasoning Agent",
    description: "Scores 4 hospital evidence clusters on confidence, user count, source corroboration and recency. Invokes Amazon Nova Pro for structured patient experience recommendations.",
    last_run_status: "success",
    last_run_at: "2026-03-15T06:15:00Z",
    total_runs: 9,
    lambda_function_name: "veloquity-reasoning-dev"
  },
  {
    name: "governance",
    display_name: "Governance Agent",
    description: "Runs daily at 06:00 UTC via EventBridge. Monitors 4 active evidence clusters for stale signals. Promoted 3 high-frequency signals. Cache hit rate 89% — above healthy threshold.",
    last_run_status: "success",
    last_run_at: "2026-03-15T06:00:00Z",
    total_runs: 15,
    lambda_function_name: "veloquity-governance-dev"
  }
]

export const HOSPITAL_MOCK_GOVERNANCE = {
  total_events: 8,
  stale_signals: 0,
  promoted_signals: 3,
  cache_hit_rate: 0.89,
  last_run: "2026-03-15T06:00:00Z"
}

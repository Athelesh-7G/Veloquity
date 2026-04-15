export const MOCK_EVIDENCE = [
  {
    id: "ev-001",
    theme: "Mobile App Performance Degradation",
    confidence: 0.91,
    user_count: 247,
    source_distribution: { app_store: 68, supportTickets:32 },
    representative_quotes: [
      { text: "App crashes every time I try to load my dashboard on iPhone 14", source: "App Store" },
      { text: "Mobile performance has gotten significantly worse since the last update", source: "Support Tickets" },
      { text: "Loading times are 8-12 seconds on mobile, completely unusable", source: "App Store" }
    ],
    representativeItems: [
      { id: 'ev001-r01', source: 'App Store' as const, text: 'App crashes every time I try to load my dashboard on iPhone 14', date: '2026-03-10', rating: 1 },
      { id: 'ev001-r02', source: 'Support Tickets' as const, text: 'Mobile performance has gotten significantly worse since the last update', date: '2026-03-09' },
      { id: 'ev001-r03', source: 'App Store' as const, text: 'Loading times are 8-12 seconds on mobile, completely unusable', date: '2026-03-08', rating: 1 },
      { id: 'ev001-r04', source: 'App Store' as const, text: 'App is barely usable on my phone. Everything lags by 5-10 seconds', date: '2026-03-07', rating: 1 },
      { id: 'ev001-r05', source: 'Support Tickets' as const, text: '50 mobile users reporting slow load times since the March release. Not a network issue.', date: '2026-03-06' },
      { id: 'ev001-r06', source: 'App Store' as const, text: 'Performance degraded badly on mobile since last update. Was fast before.', date: '2026-03-05', rating: 2 },
      { id: 'ev001-r07', source: 'Support Tickets' as const, text: 'Mobile load time increased from 2s to 12s after latest release. Confirmed on 3 devices.', date: '2026-03-04' },
      { id: 'ev001-r08', source: 'App Store' as const, text: 'Please optimize for mobile. The experience is unacceptably slow on iPhone.', date: '2026-03-03', rating: 1 },
      { id: 'ev001-r09', source: 'Support Tickets' as const, text: 'iPhone users experiencing 10+ second loads on main screen since the update.', date: '2026-03-02' },
      { id: 'ev001-r10', source: 'App Store' as const, text: 'Downgrading until mobile performance is fixed. Unusable for daily use.', date: '2026-03-01', rating: 1 },
    ],
    status: "active",
    created_at: "2026-02-15T10:00:00Z"
  },
  {
    id: "ev-002",
    theme: "Dark Mode Feature Request",
    confidence: 0.87,
    user_count: 189,
    source_distribution: { app_store: 45, supportTickets:55 },
    representative_quotes: [
      { text: "Please add dark mode, my eyes hurt using this at night", source: "App Store" },
      { text: "Dark mode is the most requested feature in our team survey", source: "Support Tickets" },
      { text: "Every competitor has dark mode, we need this to stay competitive", source: "App Store" }
    ],
    representativeItems: [
      { id: 'ev002-r01', source: 'App Store' as const, text: 'Please add dark mode, my eyes hurt using this at night', date: '2026-03-10', rating: 3 },
      { id: 'ev002-r02', source: 'Support Tickets' as const, text: 'Dark mode is the most requested feature in our team survey by far', date: '2026-03-09' },
      { id: 'ev002-r03', source: 'App Store' as const, text: 'Every competitor has dark mode. This is a table stakes feature now.', date: '2026-03-08', rating: 4 },
      { id: 'ev002-r04', source: 'App Store' as const, text: 'I work late hours and the bright white interface is painful on my eyes', date: '2026-03-07', rating: 3 },
      { id: 'ev002-r05', source: 'Support Tickets' as const, text: 'Dark mode would reduce eye strain for our night shift operators significantly', date: '2026-03-06' },
      { id: 'ev002-r06', source: 'App Store' as const, text: 'Please add OLED-friendly dark mode. Would improve battery life too.', date: '2026-03-05', rating: 3 },
      { id: 'ev002-r07', source: 'Support Tickets' as const, text: '120 users voted for dark mode in our internal survey. Top-requested feature.', date: '2026-03-04' },
      { id: 'ev002-r08', source: 'App Store' as const, text: 'Love the app but dark mode is the one feature I need. Work evenings a lot.', date: '2026-03-03', rating: 4 },
      { id: 'ev002-r09', source: 'App Store' as const, text: 'Dark mode would be a game changer for night usage. Please prioritize.', date: '2026-03-02', rating: 3 },
      { id: 'ev002-r10', source: 'Support Tickets' as const, text: 'Our entire team uses the app in a dimly lit environment. Dark mode is essential.', date: '2026-03-01' },
    ],
    status: "active",
    created_at: "2026-02-18T14:00:00Z"
  },
  {
    id: "ev-003",
    theme: "Data Export Reliability Issues",
    confidence: 0.78,
    user_count: 134,
    source_distribution: { app_store: 20, supportTickets:80 },
    representative_quotes: [
      { text: "CSV export fails silently when date range exceeds 30 days", source: "Support Tickets" },
      { text: "Export button does nothing on Firefox, works on Chrome", source: "Support Tickets" },
      { text: "Lost 2 hours of work because export corrupted my data", source: "Support Tickets" }
    ],
    representativeItems: [
      { id: 'ev003-r01', source: 'Support Tickets' as const, text: 'CSV export fails silently when date range exceeds 30 days', date: '2026-03-10' },
      { id: 'ev003-r02', source: 'Support Tickets' as const, text: 'Export button does nothing on Firefox. Works on Chrome only.', date: '2026-03-09' },
      { id: 'ev003-r03', source: 'Support Tickets' as const, text: 'Lost 2 hours of work because export corrupted my data completely', date: '2026-03-08' },
      { id: 'ev003-r04', source: 'Support Tickets' as const, text: 'Success toast shown but downloaded file is always 0 bytes', date: '2026-03-07' },
      { id: 'ev003-r05', source: 'App Store' as const, text: 'Export is completely broken. No file, no error message. Silent failure every time.', date: '2026-03-06', rating: 1 },
      { id: 'ev003-r06', source: 'Support Tickets' as const, text: 'Export silently fails for datasets over 5000 rows with no notification at all', date: '2026-03-05' },
      { id: 'ev003-r07', source: 'App Store' as const, text: 'Tried exporting on three different browsers. Same broken result every time.', date: '2026-03-04', rating: 1 },
      { id: 'ev003-r08', source: 'Support Tickets' as const, text: 'Data export has been unreliable for 3 weeks. Blocking our entire reporting pipeline.', date: '2026-03-03' },
      { id: 'ev003-r09', source: 'App Store' as const, text: 'Export spinner appears for one second then disappears. No file downloads.', date: '2026-03-02', rating: 1 },
      { id: 'ev003-r10', source: 'Support Tickets' as const, text: 'Large dataset export always fails silently. An email fallback would help greatly.', date: '2026-03-01' },
    ],
    status: "active",
    created_at: "2026-02-20T09:00:00Z"
  },
  {
    id: "ev-004",
    theme: "Enterprise SSO Integration Demand",
    confidence: 0.82,
    user_count: 98,
    source_distribution: { app_store: 10, supportTickets:90 },
    representative_quotes: [
      { text: "Our security team requires SSO before we can expand our license", source: "Support Tickets" },
      { text: "SAML integration is blocking our enterprise rollout", source: "Support Tickets" },
      { text: "Okta support is non-negotiable for us", source: "Support Tickets" }
    ],
    representativeItems: [
      { id: 'ev004-r01', source: 'Support Tickets' as const, text: 'Our security team requires SSO before we can expand our license', date: '2026-03-10' },
      { id: 'ev004-r02', source: 'Support Tickets' as const, text: 'SAML integration is blocking our enterprise rollout completely', date: '2026-03-09' },
      { id: 'ev004-r03', source: 'Support Tickets' as const, text: 'Okta support is non-negotiable for our security compliance requirements', date: '2026-03-08' },
      { id: 'ev004-r04', source: 'Support Tickets' as const, text: 'We cannot deploy to 500 more users without enterprise SSO support', date: '2026-03-07' },
      { id: 'ev004-r05', source: 'Support Tickets' as const, text: 'Azure AD integration required for our IT policy. Blocking all expansion.', date: '2026-03-06' },
      { id: 'ev004-r06', source: 'Support Tickets' as const, text: 'SSO is the only blocker for our $80k enterprise license renewal', date: '2026-03-05' },
      { id: 'ev004-r07', source: 'App Store' as const, text: 'Great product but no SSO makes enterprise adoption impossible for us', date: '2026-03-04', rating: 3 },
      { id: 'ev004-r08', source: 'Support Tickets' as const, text: 'Security team rejected our license expansion request due to missing SSO support', date: '2026-03-03' },
      { id: 'ev004-r09', source: 'Support Tickets' as const, text: 'SCIM provisioning plus SAML SSO are required for our enterprise compliance', date: '2026-03-02' },
      { id: 'ev004-r10', source: 'Support Tickets' as const, text: 'Without SSO we cannot manage user access at scale. This is a hard blocker.', date: '2026-03-01' },
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
  cross_cluster_insight: "Mobile performance issues correlate strongly with enterprise churn signals in support ticket data, suggesting the performance problem disproportionately affects high-value accounts.",
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
      tradeoff: "Low effort fix with immediate trust recovery for power users. 80% of signals from enterprise support tickets.",
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
    description: "Ingests App Store reviews and support tickets. Applies PII redaction and SHA-256 deduplication before landing to S3.",
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
    ],
    representativeItems: [
      { id: 'hev001-r01', source: 'Patient Portal' as const, text: 'Waited 4 hours in the ER with chest pain. No updates or acknowledgment from any staff.', date: '2026-03-20', rating: 1 },
      { id: 'hev001-r02', source: 'Hospital Survey' as const, text: 'ER wait times have doubled this year. My family has experienced this 3 times. Systemic failure.', date: '2026-03-18' },
      { id: 'hev001-r03', source: 'Patient Portal' as const, text: 'My 82-year-old mother waited 5 hours with a suspected hip fracture. No pain relief while waiting.', date: '2026-03-15', rating: 1 },
      { id: 'hev001-r04', source: 'Hospital Survey' as const, text: 'Emergency department is clearly overwhelmed. Staff are kind but the triage system is broken.', date: '2026-03-12' },
      { id: 'hev001-r05', source: 'Patient Portal' as const, text: 'Arrived with breathing difficulties. 3.5 hour wait before anyone acknowledged our presence.', date: '2026-03-10', rating: 1 },
      { id: 'hev001-r06', source: 'Hospital Survey' as const, text: 'App showed 30-minute ER wait but we waited 4+ hours. The wait time display is completely false.', date: '2026-03-08' },
      { id: 'hev001-r07', source: 'Patient Portal' as const, text: 'ER staff were kind but the 6-hour wait for a broken wrist was completely unacceptable.', date: '2026-03-05', rating: 1 },
      { id: 'hev001-r08', source: 'Hospital Survey' as const, text: '3 hours in the ER with my child running a 104F fever. No communication during the entire wait.', date: '2026-03-02' },
      { id: 'hev001-r09', source: 'Patient Portal' as const, text: 'Nobody came to check on patients in the waiting room for over 2 hours. We felt completely abandoned.', date: '2026-02-28', rating: 1 },
      { id: 'hev001-r10', source: 'Hospital Survey' as const, text: 'ER wait times are pushing patients to leave without being seen. I nearly left after 3.5 hours.', date: '2026-02-25' },
    ],
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
    ],
    representativeItems: [
      { id: 'hev002-r01', source: 'Patient Portal' as const, text: 'Booking portal crashes every time I try to confirm my appointment. Tried 3 different phones.', date: '2026-03-14', rating: 1 },
      { id: 'hev002-r02', source: 'Hospital Survey' as const, text: 'Got double-booked through the online system twice in one month. Showed up and another patient had my slot.', date: '2026-03-13' },
      { id: 'hev002-r03', source: 'Patient Portal' as const, text: 'No confirmation email after booking. I have to call the hospital to verify every appointment I make online.', date: '2026-03-11', rating: 2 },
      { id: 'hev002-r04', source: 'Hospital Survey' as const, text: 'Portal times out and loses all entered insurance information. Have to start over every time.', date: '2026-03-10' },
      { id: 'hev002-r05', source: 'Patient Portal' as const, text: 'Portal app crashes on appointment confirmation screen. Completely broken for 2 weeks.', date: '2026-03-09', rating: 1 },
      { id: 'hev002-r06', source: 'Hospital Survey' as const, text: 'Online booking shows slots as available but they are already booked. System not syncing correctly.', date: '2026-03-08' },
      { id: 'hev002-r07', source: 'Patient Portal' as const, text: 'Session timeout logs me out mid-booking and I lose all my entered information every time.', date: '2026-03-07', rating: 2 },
      { id: 'hev002-r08', source: 'Hospital Survey' as const, text: 'Appointment confirmation takes me back to the home screen with no confirmation message at all.', date: '2026-03-05' },
      { id: 'hev002-r09', source: 'Patient Portal' as const, text: 'The front desk confirmed this is a known issue with the portal. Why has it not been fixed?', date: '2026-03-03', rating: 1 },
      { id: 'hev002-r10', source: 'Hospital Survey' as const, text: 'Double-booked twice in one month through the online system. This wastes everyone\'s time.', date: '2026-03-01' },
    ],
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
    ],
    representativeItems: [
      { id: 'hev003-r01', source: 'Hospital Survey' as const, text: 'Received a bill for a service I never received. Dispute ignored for 3 weeks with no response.', date: '2026-03-14' },
      { id: 'hev003-r02', source: 'Hospital Survey' as const, text: 'Insurance was pre-approved but not applied. Billed at full uninsured rate. Called 4 times. Still unresolved.', date: '2026-03-12' },
      { id: 'hev003-r03', source: 'Hospital Survey' as const, text: 'Two separate bills arrived for the same hospital stay with different amounts. I do not know which is correct.', date: '2026-03-10' },
      { id: 'hev003-r04', source: 'Hospital Survey' as const, text: 'Charged at inpatient rates for an outpatient procedure. $3,200 overcharge. Dispute filed 2 months ago.', date: '2026-03-08' },
      { id: 'hev003-r05', source: 'Hospital Survey' as const, text: 'Bill dispute filed 30 days ago. No response, no acknowledgement, no contact from billing at all.', date: '2026-03-06' },
      { id: 'hev003-r06', source: 'Hospital Survey' as const, text: 'Billed $1,200 for an MRI scan I never received because the appointment was cancelled beforehand.', date: '2026-03-04' },
      { id: 'hev003-r07', source: 'Hospital Survey' as const, text: 'Insurance pre-authorization was on file but completely ignored. This has been ongoing for 2 months.', date: '2026-03-02' },
      { id: 'hev003-r08', source: 'Hospital Survey' as const, text: 'Statement shows services from a date I was not even at the hospital. Clearly a billing system error.', date: '2026-02-28' },
      { id: 'hev003-r09', source: 'Hospital Survey' as const, text: 'Itemized bill has duplicate charges for the same lab test performed on the same day.', date: '2026-02-26' },
      { id: 'hev003-r10', source: 'Hospital Survey' as const, text: 'Billing department unreachable. Phone hold times consistently over 45 minutes with no callback option.', date: '2026-02-24' },
    ],
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
    ],
    representativeItems: [
      { id: 'hev004-r01', source: 'Patient Portal' as const, text: 'Cannot log into MyChart. Reset password three times. Still locked out with invalid credentials error.', date: '2026-03-13', rating: 1 },
      { id: 'hev004-r02', source: 'Patient Portal' as const, text: 'Test results were supposed to appear within 48 hours. Still missing after 2 weeks. I need these for my follow-up.', date: '2026-03-12', rating: 1 },
      { id: 'hev004-r03', source: 'Patient Portal' as const, text: 'Portal app crashes immediately on Android. Web version is very slow. Cannot access my records at all.', date: '2026-03-11', rating: 1 },
      { id: 'hev004-r04', source: 'Patient Portal' as const, text: 'Medication list in the portal is completely wrong. Two discontinued medications still showing as active.', date: '2026-03-10', rating: 2 },
      { id: 'hev004-r05', source: 'Patient Portal' as const, text: 'Password reset loop: reset successfully but still denied on login. Cannot access my medical records.', date: '2026-03-08', rating: 1 },
      { id: 'hev004-r06', source: 'Patient Portal' as const, text: 'Cannot access my imaging results. Portal says loading for hours then times out with no result.', date: '2026-03-06', rating: 1 },
      { id: 'hev004-r07', source: 'Patient Portal' as const, text: 'My care team contact info in MyChart is completely outdated. All phone numbers go to wrong departments.', date: '2026-03-04', rating: 2 },
      { id: 'hev004-r08', source: 'Patient Portal' as const, text: 'MyChart app on Samsung Galaxy S23 crashes immediately after the splash screen every single time.', date: '2026-03-02', rating: 1 },
      { id: 'hev004-r09', source: 'Patient Portal' as const, text: 'Appointment history only shows last 3 months. I need records going back 2 years for a specialist referral.', date: '2026-02-28', rating: 2 },
      { id: 'hev004-r10', source: 'Patient Portal' as const, text: 'After the iOS update MyChart requires full re-authentication every time I open the app. Very frustrating.', date: '2026-02-26', rating: 1 },
    ],
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

// ─── Feedback Data Items ──────────────────────────────────────────────────────

export interface FeedbackDataItem {
  id: string
  source: 'appstore' | 'support_tickets' | 'patient_portal' | 'hospital_survey'
  text: string
  date: string
  rating?: number
  cluster: string
  metadata: Record<string, string>
}

export const APP_PRODUCT_ITEMS: FeedbackDataItem[] = [
  // ── Cluster: App crashes on project switch (15 appstore, 15 support_tickets) ────────
  { id: 'ap001', source: 'appstore', rating: 1, date: '2026-03-12', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'App dies every time I switch to another project. Lost all my work twice. Started after the v2.4 update.' },
  { id: 'ap002', source: 'appstore', rating: 1, date: '2026-03-10', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'Switching projects gives an instant crash, no warning, no autosave. 100% reproducible.' },
  { id: 'ap003', source: 'appstore', rating: 2, date: '2026-03-09', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'Used to be a 5-star app. After the latest update, project switching is completely broken. App closes without warning.' },
  { id: 'ap004', source: 'appstore', rating: 1, date: '2026-03-08', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'Null pointer crash on project context switch. Visible in logs. Easy to reproduce: open two projects and switch.' },
  { id: 'ap005', source: 'appstore', rating: 1, date: '2026-03-07', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'My entire team of 20 cannot switch between projects. We are completely blocked by this regression.' },
  { id: 'ap006', source: 'appstore', rating: 1, date: '2026-03-06', cluster: 'App crashes on project switch', metadata: { version: '2.4.1' }, text: 'Three crashes today just from switching workspaces. Please patch urgently. Data loss every time.' },
  { id: 'ap007', source: 'appstore', rating: 1, date: '2026-03-05', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'First-time user here and already hit the project switch crash. Very poor first impression.' },
  { id: 'ap008', source: 'appstore', rating: 2, date: '2026-03-03', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'Lost all my annotations twice due to the project switch crash. Rating 1 until fixed.' },
  { id: 'ap009', source: 'appstore', rating: 1, date: '2026-03-01', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'This crash is 100% reliable and 100% data-destroying. It must be fixed before the next release.' },
  { id: 'ap010', source: 'appstore', rating: 1, date: '2026-02-28', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'Paid for the pro plan and cannot even switch projects without crashing. Extremely disappointing.' },
  { id: 'ap011', source: 'appstore', rating: 1, date: '2026-02-26', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'Every single team member on my account is affected. We are stuck on single-project mode.' },
  { id: 'ap012', source: 'appstore', rating: 2, date: '2026-02-24', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'Project switch crash introduced in v2.4. Everything was fine on v2.3.1. Please roll back or hotfix.' },
  { id: 'ap013', source: 'appstore', rating: 1, date: '2026-02-22', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'This crash is blocking all cross-project work. Three hours of re-entry this week due to lost state.' },
  { id: 'ap014', source: 'appstore', rating: 1, date: '2026-02-20', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'The crash only happens on cold switch — switching within a project is fine. Context flush issue.' },
  { id: 'ap015', source: 'appstore', rating: 1, date: '2026-02-18', cluster: 'App crashes on project switch', metadata: { version: '2.4.0' }, text: 'Filed this bug 10 days ago. Still no patch. Our team of 15 is fully blocked from cross-project work.' },
  { id: 'ap016', source: 'support_tickets', date: '2026-03-11', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4821', priority: 'high' }, text: 'Critical: crash on project context switch. Reproducible every time. Full crash log attached. Please escalate.' },
  { id: 'ap017', source: 'support_tickets', date: '2026-03-10', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4819', priority: 'high' }, text: 'Our entire enterprise account is affected by the project switch crash introduced in v2.4.' },
  { id: 'ap018', source: 'support_tickets', date: '2026-03-09', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4815', priority: 'high' }, text: 'All 15 members of our team cannot switch projects without crashing. Attaching null pointer trace.' },
  { id: 'ap019', source: 'support_tickets', date: '2026-03-08', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4811', priority: 'high' }, text: 'Project switch crash regression from v2.4. Was stable in v2.3.1. Need this hotfixed this week.' },
  { id: 'ap020', source: 'support_tickets', date: '2026-03-07', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4807', priority: 'high' }, text: 'The project context is not being flushed before navigation. Race condition. Happy to share full logs.' },
  { id: 'ap021', source: 'support_tickets', date: '2026-03-06', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4803', priority: 'high' }, text: 'This crash has cost our team 3 hours of re-entry work this week. Blocking daily standups.' },
  { id: 'ap022', source: 'support_tickets', date: '2026-03-05', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4799', priority: 'high' }, text: 'Multiple enterprise clients are affected by the project switch crash. Need an urgent patch.' },
  { id: 'ap023', source: 'support_tickets', date: '2026-03-04', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4796', priority: 'high' }, text: 'iOS 17.4 + project switch = guaranteed crash. Reproducible in 2 steps. Attaching device logs.' },
  { id: 'ap024', source: 'support_tickets', date: '2026-03-03', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4791', priority: 'high' }, text: 'Escalating: project switch crash affecting all users on latest iOS. 12 tickets from one account alone.' },
  { id: 'ap025', source: 'support_tickets', date: '2026-03-01', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4785', priority: 'high' }, text: 'Null pointer on project context load. Same device, same steps, every time. This is a complete regression.' },
  { id: 'ap026', source: 'support_tickets', date: '2026-02-28', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4779', priority: 'high' }, text: 'Filed 10 days ago. Still no patch. Our team cannot do cross-project work until this is resolved.' },
  { id: 'ap027', source: 'support_tickets', date: '2026-02-26', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4773', priority: 'high' }, text: 'The cold switch crash is 100% reproducible. Warm switch (stay in project) is unaffected. Context load issue.' },
  { id: 'ap028', source: 'support_tickets', date: '2026-02-24', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4768', priority: 'high' }, text: 'We traced the crash to the project context handler. Null pointer on project B load when context A is still active.' },
  { id: 'ap029', source: 'support_tickets', date: '2026-02-22', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4763', priority: 'high' }, text: 'Crash introduced in v2.4 exactly. Branch comparison confirms the regression source. Please fix urgently.' },
  { id: 'ap030', source: 'support_tickets', date: '2026-02-20', cluster: 'App crashes on project switch', metadata: { ticket: 'ZD-4758', priority: 'high' }, text: 'Our CTO has escalated this to your enterprise support. 50 users cannot use multi-project workflows.' },

  // ── Cluster: Black screen after latest update (10 appstore, 10 support_tickets) ─────
  { id: 'ap031', source: 'appstore', rating: 1, date: '2026-02-18', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'Black screen for 20 seconds after the update. Sometimes never loads. Have to force-quit daily.' },
  { id: 'ap032', source: 'appstore', rating: 1, date: '2026-02-15', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'Cold start always shows a black screen now. Warm restart works fine. Some async init deadlock.' },
  { id: 'ap033', source: 'appstore', rating: 1, date: '2026-02-13', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'Every morning the app shows a black screen for 15-20 seconds. Started exactly when I updated to 2.4.' },
  { id: 'ap034', source: 'appstore', rating: 1, date: '2026-02-11', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'Updated to 2.4 and now the app is unusable on first launch. Please roll back or hotfix immediately.' },
  { id: 'ap035', source: 'appstore', rating: 2, date: '2026-02-09', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'Black screen on launch only — warm restart works fine. Suspect an async init race condition in 2.4.' },
  { id: 'ap036', source: 'appstore', rating: 1, date: '2026-02-07', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'iPhone 14 Pro: black screen every cold start after v2.4. Other apps unaffected. Must be your init code.' },
  { id: 'ap037', source: 'appstore', rating: 1, date: '2026-02-05', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'App shows black screen for 15-20 seconds then sometimes crashes before loading. 2.3 was fine.' },
  { id: 'ap038', source: 'appstore', rating: 1, date: '2026-02-03', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'Please roll back to 2.3. The black screen on launch is a dealbreaker for morning productivity.' },
  { id: 'ap039', source: 'appstore', rating: 2, date: '2026-02-01', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'Black screen happens on my iPad too. Both devices affected since 2.4 update 3 weeks ago.' },
  { id: 'ap040', source: 'appstore', rating: 1, date: '2026-01-30', cluster: 'Black screen after latest update', metadata: { version: '2.4.0' }, text: 'App worked perfectly before 2.4. Now it is a black screen lottery every morning.' },
  { id: 'ap041', source: 'support_tickets', date: '2026-02-17', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4751', priority: 'high' }, text: '12 users on our account all reporting black screen on cold start since the 2.4 update.' },
  { id: 'ap042', source: 'support_tickets', date: '2026-02-15', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4747', priority: 'high' }, text: 'Black screen on launch — suspected async init deadlock. Warm restart resolves. Cold start always affected.' },
  { id: 'ap043', source: 'support_tickets', date: '2026-02-13', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4743', priority: 'medium' }, text: 'All users on iOS 17 are reporting black screen on their first daily launch of the app since 2.4.' },
  { id: 'ap044', source: 'support_tickets', date: '2026-02-11', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4739', priority: 'high' }, text: 'The black screen issue correlates exactly with the 2.4 release timestamp. Was fine in 2.3.1.' },
  { id: 'ap045', source: 'support_tickets', date: '2026-02-09', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4735', priority: 'high' }, text: 'Cold start deadlock introduced in 2.4. Confirmed on iPhone 13, 14, and iPad Pro universally.' },
  { id: 'ap046', source: 'support_tickets', date: '2026-02-07', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4731', priority: 'medium' }, text: 'Enterprise team cannot reliably use the app first thing in the morning due to black screen on cold start.' },
  { id: 'ap047', source: 'support_tickets', date: '2026-02-05', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4727', priority: 'high' }, text: 'The fix for the black screen should be the top priority — it impacts every user on their first interaction.' },
  { id: 'ap048', source: 'support_tickets', date: '2026-02-03', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4723', priority: 'medium' }, text: 'Black screen duration varies 10-30 seconds per device. Sometimes crashes instead of loading correctly.' },
  { id: 'ap049', source: 'support_tickets', date: '2026-02-01', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4719', priority: 'high' }, text: '50 users affected by the black screen cold start. This is impacting our entire company daily.' },
  { id: 'ap050', source: 'support_tickets', date: '2026-01-29', cluster: 'Black screen after latest update', metadata: { ticket: 'ZD-4715', priority: 'medium' }, text: 'Background refresh is on, battery optimization is off. Still black screen on cold start every day.' },

  // ── Cluster: Dashboard load regression (10 appstore, 10 support_tickets) ─────────────
  { id: 'ap051', source: 'appstore', rating: 1, date: '2026-01-27', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'Dashboard loads in 12 seconds now. Was instant before the update. Performance is terrible.' },
  { id: 'ap052', source: 'appstore', rating: 2, date: '2026-01-25', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'Main screen takes forever to load. Widgets appear one by one instead of together. Very slow.' },
  { id: 'ap053', source: 'appstore', rating: 1, date: '2026-01-23', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'App felt snappy before. Now the dashboard spins for 10+ seconds every single time I open it.' },
  { id: 'ap054', source: 'appstore', rating: 2, date: '2026-01-21', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'Load time regression: dashboard went from ~2s to 14s after v2.4. Checked my connection — not the issue.' },
  { id: 'ap055', source: 'appstore', rating: 1, date: '2026-01-19', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'Dashboard performance is terrible. 12 seconds to load on fiber internet. Something changed in 2.4.' },
  { id: 'ap056', source: 'appstore', rating: 2, date: '2026-01-17', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'Every day I wait 12+ seconds for the dashboard. Getting very frustrating. Please optimize the load sequence.' },
  { id: 'ap057', source: 'appstore', rating: 1, date: '2026-01-15', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'The widgets load one by one instead of all at once. Was this parallel before 2.4? Something changed.' },
  { id: 'ap058', source: 'appstore', rating: 2, date: '2026-01-13', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'App has slowed down noticeably. Dashboard worst affected. 6 seconds on iPad Pro which is embarrassing.' },
  { id: 'ap059', source: 'appstore', rating: 1, date: '2026-01-11', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: '6 second dashboard load on a brand new iPad Pro is unacceptable for a productivity app.' },
  { id: 'ap060', source: 'appstore', rating: 2, date: '2026-01-09', cluster: 'Dashboard load regression', metadata: { version: '2.4.0' }, text: 'Widgets now load sequentially. Before 2.4 they loaded in parallel. Was parallel fetching removed?' },
  { id: 'ap061', source: 'support_tickets', date: '2026-01-27', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4711', priority: 'high' }, text: 'Enterprise workspace with 200+ projects: dashboard now takes 15 seconds to load. Blocking daily standups.' },
  { id: 'ap062', source: 'support_tickets', date: '2026-01-25', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4707', priority: 'high' }, text: 'Dashboard load regression measured precisely: 2.1s before v2.4, 12.4s after. Not a network issue.' },
  { id: 'ap063', source: 'support_tickets', date: '2026-01-23', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4703', priority: 'high' }, text: 'Our team standups are blocked by 12+ second dashboard loads. This is affecting our SLA metrics.' },
  { id: 'ap064', source: 'support_tickets', date: '2026-01-21', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4699', priority: 'medium' }, text: 'Dashboard performance scales badly with project count after v2.4. 250 projects = 15s load time.' },
  { id: 'ap065', source: 'support_tickets', date: '2026-01-19', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4695', priority: 'medium' }, text: 'Render cycle seems to have changed — widgets now fetch sequentially instead of in parallel in 2.4.' },
  { id: 'ap066', source: 'support_tickets', date: '2026-01-17', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4691', priority: 'high' }, text: 'Performance regression confirmed on 3 separate devices and 2 network connections. Not environment-specific.' },
  { id: 'ap067', source: 'support_tickets', date: '2026-01-15', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4687', priority: 'medium' }, text: 'Dashboard went from acceptable to unusable for power users with large workspaces after v2.4.' },
  { id: 'ap068', source: 'support_tickets', date: '2026-01-13', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4683', priority: 'high' }, text: 'Frontend profiling shows redundant re-renders in the dashboard component post-2.4. Clear regression.' },
  { id: 'ap069', source: 'support_tickets', date: '2026-01-11', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4679', priority: 'medium' }, text: 'The dashboard load regression is affecting our enterprise SLA. Clients are complaining.' },
  { id: 'ap070', source: 'support_tickets', date: '2026-01-09', cluster: 'Dashboard load regression', metadata: { ticket: 'ZD-4675', priority: 'high' }, text: 'Dashboard loads 6x slower since v2.4. This is not acceptable for an enterprise-grade productivity tool.' },

  // ── Cluster: No onboarding checklist (8 appstore, 7 support_tickets) ─────────────────
  { id: 'ap071', source: 'appstore', rating: 2, date: '2025-12-20', cluster: 'No onboarding checklist', metadata: { version: '2.3.0' }, text: 'Signed up and had no idea where to start. No checklist, no welcome tour, nothing at all.' },
  { id: 'ap072', source: 'appstore', rating: 3, date: '2025-12-10', cluster: 'No onboarding checklist', metadata: { version: '2.3.0' }, text: 'Every competitor has an onboarding flow. This app has nothing to help new users get started.' },
  { id: 'ap073', source: 'appstore', rating: 2, date: '2025-11-30', cluster: 'No onboarding checklist', metadata: { version: '2.3.0' }, text: 'Took 30 minutes to find the project creation option. A getting started guide would really help.' },
  { id: 'ap074', source: 'appstore', rating: 3, date: '2025-11-20', cluster: 'No onboarding checklist', metadata: { version: '2.3.0' }, text: 'No setup wizard makes the learning curve very steep for every new team member we add.' },
  { id: 'ap075', source: 'appstore', rating: 2, date: '2025-11-10', cluster: 'No onboarding checklist', metadata: { version: '2.2.0' }, text: 'A simple 5-step checklist would dramatically improve the first-time experience for new users.' },
  { id: 'ap076', source: 'appstore', rating: 3, date: '2025-10-30', cluster: 'No onboarding checklist', metadata: { version: '2.2.0' }, text: 'The app is powerful but completely undiscoverable. New users need hand-holding and guidance.' },
  { id: 'ap077', source: 'appstore', rating: 2, date: '2025-10-15', cluster: 'No onboarding checklist', metadata: { version: '2.2.0' }, text: 'I keep having to onboard new team members manually. There is zero in-app guidance for newcomers.' },
  { id: 'ap078', source: 'appstore', rating: 3, date: '2025-10-01', cluster: 'No onboarding checklist', metadata: { version: '2.2.0' }, text: 'Please add an interactive setup wizard. The first-time UX is poor without any onboarding checklist.' },
  { id: 'ap079', source: 'support_tickets', date: '2025-12-15', cluster: 'No onboarding checklist', metadata: { ticket: 'ZD-4671', priority: 'medium' }, text: 'Every new team member needs a 30-minute walkthrough from an existing user. No in-app onboarding exists.' },
  { id: 'ap080', source: 'support_tickets', date: '2025-11-25', cluster: 'No onboarding checklist', metadata: { ticket: 'ZD-4667', priority: 'medium' }, text: 'We lose at least 1 hour per new hire due to the missing onboarding flow. Feature request: checklist.' },
  { id: 'ap081', source: 'support_tickets', date: '2025-11-15', cluster: 'No onboarding checklist', metadata: { ticket: 'ZD-4663', priority: 'medium' }, text: 'Requesting onboarding checklist feature. High priority for our rapidly growing team.' },
  { id: 'ap082', source: 'support_tickets', date: '2025-11-05', cluster: 'No onboarding checklist', metadata: { ticket: 'ZD-4659', priority: 'low' }, text: 'New user activation rate is low because there is no guidance after signup. Please add a welcome flow.' },
  { id: 'ap083', source: 'support_tickets', date: '2025-10-25', cluster: 'No onboarding checklist', metadata: { ticket: 'ZD-4655', priority: 'medium' }, text: 'Our CS team receives the same 3 onboarding questions from every new user. In-app checklist would fix this.' },
  { id: 'ap084', source: 'support_tickets', date: '2025-10-15', cluster: 'No onboarding checklist', metadata: { ticket: 'ZD-4651', priority: 'low' }, text: 'All major competitors have onboarding checklists. This is a significant UX gap in our product.' },
  { id: 'ap085', source: 'support_tickets', date: '2025-10-05', cluster: 'No onboarding checklist', metadata: { ticket: 'ZD-4647', priority: 'medium' }, text: 'Please add a dismissible getting started checklist overlay for first-time users. Simple and high impact.' },

  // ── Cluster: Export to CSV silently fails (5 appstore, 5 support_tickets) ─────────────
  { id: 'ap086', source: 'appstore', rating: 1, date: '2025-12-01', cluster: 'Export to CSV silently fails', metadata: { version: '2.3.1' }, text: 'CSV export shows a success toast but the downloaded file is 0 bytes. Completely broken on Chrome.' },
  { id: 'ap087', source: 'appstore', rating: 1, date: '2025-11-15', cluster: 'Export to CSV silently fails', metadata: { version: '2.3.1' }, text: 'Export button does nothing visible. No file, no error, no download. Silent failure every time.' },
  { id: 'ap088', source: 'appstore', rating: 2, date: '2025-10-30', cluster: 'Export to CSV silently fails', metadata: { version: '2.3.0' }, text: 'Tried exporting on Chrome and Firefox. Same broken result each time. Export is completely non-functional.' },
  { id: 'ap089', source: 'appstore', rating: 1, date: '2025-10-15', cluster: 'Export to CSV silently fails', metadata: { version: '2.3.0' }, text: 'Export silently fails for any date range over 30 days. Useless for weekly reporting needs.' },
  { id: 'ap090', source: 'appstore', rating: 1, date: '2025-10-01', cluster: 'Export to CSV silently fails', metadata: { version: '2.3.0' }, text: 'Loading spinner appears for one second then disappears. No export happens. Extremely frustrating.' },
  { id: 'ap091', source: 'support_tickets', date: '2025-11-30', cluster: 'Export to CSV silently fails', metadata: { ticket: 'ZD-4643', priority: 'high' }, text: 'Export works for small datasets but silently fails for our 5000+ row reports. No error, no email.' },
  { id: 'ap092', source: 'support_tickets', date: '2025-11-15', cluster: 'Export to CSV silently fails', metadata: { ticket: 'ZD-4639', priority: 'high' }, text: 'CSV export success toast but empty file every time. This is blocking our entire weekly reporting process.' },
  { id: 'ap093', source: 'support_tickets', date: '2025-11-01', cluster: 'Export to CSV silently fails', metadata: { ticket: 'ZD-4635', priority: 'high' }, text: 'Silent export failure on large datasets — no error message, no email fallback, nothing at all.' },
  { id: 'ap094', source: 'support_tickets', date: '2025-10-15', cluster: 'Export to CSV silently fails', metadata: { ticket: 'ZD-4631', priority: 'medium' }, text: 'Export button completely non-functional on Firefox. Works on Chrome. Inconsistent behavior.' },
  { id: 'ap095', source: 'support_tickets', date: '2025-10-01', cluster: 'Export to CSV silently fails', metadata: { ticket: 'ZD-4627', priority: 'high' }, text: 'Data export has been broken since the latest release. Blocking our entire analytics reporting pipeline.' },

  // ── Cluster: Positive feedback (5 appstore) ───────────────────────────────────
  { id: 'ap096', source: 'appstore', rating: 5, date: '2025-09-01', cluster: 'Positive feedback', metadata: { version: '2.3.0' }, text: 'Best project management tool I have used. Fast, intuitive, and reliable. My team loves it.' },
  { id: 'ap097', source: 'appstore', rating: 5, date: '2025-08-20', cluster: 'Positive feedback', metadata: { version: '2.3.0' }, text: 'The collaboration features are excellent. We switched from Jira and the whole team is happier.' },
  { id: 'ap098', source: 'appstore', rating: 5, date: '2025-08-15', cluster: 'Positive feedback', metadata: { version: '2.3.0' }, text: '5 stars. The dashboard gives me exactly the project overview I need every single morning.' },
  { id: 'ap099', source: 'appstore', rating: 4, date: '2025-08-10', cluster: 'Positive feedback', metadata: { version: '2.3.0' }, text: 'Customer support was incredibly responsive. My issue was resolved within 2 hours. Impressive.' },
  { id: 'ap100', source: 'appstore', rating: 5, date: '2025-08-01', cluster: 'Positive feedback', metadata: { version: '2.3.0' }, text: 'Excellent app overall. Minor bugs occasionally but the core experience is fantastic and worth it.' },
]

export const HOSPITAL_ITEMS: FeedbackDataItem[] = [
  // ── Cluster: Extended Emergency Wait Times (13 patient_portal, 12 hospital_survey) ─
  { id: 'hp001', source: 'patient_portal', rating: 1, date: '2026-03-20', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.3.0', app: 'CarePoint' }, text: 'Waited 4 hours in the ER with chest pain. No updates, no acknowledgment from any staff member.' },
  { id: 'hp002', source: 'patient_portal', rating: 1, date: '2026-03-18', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.3.0', app: 'CarePoint' }, text: 'ER wait times have doubled this year. My family has experienced this 3 times now. Systemic failure.' },
  { id: 'hp003', source: 'patient_portal', rating: 1, date: '2026-03-15', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.2.1', app: 'CarePoint' }, text: 'My 82-year-old mother waited 5 hours with a suspected hip fracture. No pain relief while waiting.' },
  { id: 'hp004', source: 'patient_portal', rating: 1, date: '2026-03-12', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.2.1', app: 'CarePoint' }, text: 'Arrived with breathing difficulties. 3.5 hour wait before anyone acknowledged our presence.' },
  { id: 'hp005', source: 'patient_portal', rating: 1, date: '2026-03-10', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.2.1', app: 'CarePoint' }, text: 'App showed 30-minute ER wait but we waited 4+ hours. The wait time display is completely false.' },
  { id: 'hp006', source: 'patient_portal', rating: 1, date: '2026-03-08', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.2.0', app: 'CarePoint' }, text: 'ER staff were kind but the 6-hour wait for a broken wrist was completely unacceptable.' },
  { id: 'hp007', source: 'patient_portal', rating: 1, date: '2026-03-05', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.2.0', app: 'CarePoint' }, text: '3 hours in the ER with my child running a 104F fever. No communication during the entire wait.' },
  { id: 'hp008', source: 'patient_portal', rating: 1, date: '2026-03-02', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.2.0', app: 'CarePoint' }, text: 'Nobody came to check on patients in the waiting room for over 2 hours. We felt completely abandoned.' },
  { id: 'hp009', source: 'patient_portal', rating: 1, date: '2026-02-28', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.2.0', app: 'CarePoint' }, text: 'ER wait times are pushing patients to leave without being seen. I nearly left after 3.5 hours.' },
  { id: 'hp010', source: 'patient_portal', rating: 1, date: '2026-02-25', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.2.0', app: 'CarePoint' }, text: '6-hour ER wait on a quiet Tuesday evening. Something is fundamentally broken in the system.' },
  { id: 'hp011', source: 'patient_portal', rating: 1, date: '2026-02-22', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'My father had stroke symptoms and waited 45 minutes just to be called back to triage. Dangerous.' },
  { id: 'hp012', source: 'patient_portal', rating: 1, date: '2026-02-19', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'The ER was chaotic and disorganised. No one could tell us how long the wait would be.' },
  { id: 'hp013', source: 'patient_portal', rating: 1, date: '2026-02-16', cluster: 'Extended Emergency Wait Times', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'My aunt waited 5 hours without pain management or a proper seat. This is not acceptable care.' },
  { id: 'hp014', source: 'hospital_survey', date: '2026-03-22', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'post-visit', priority: 'high' }, text: 'Patient complaint: 4-hour ER wait for chest pain patient. Safety concern escalated to risk management.' },
  { id: 'hp015', source: 'hospital_survey', date: '2026-03-20', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'post-visit', priority: 'high' }, text: 'Survey response: ER wait times rated 1/5. Systemic issue flagged by 12 separate patients this week.' },
  { id: 'hp016', source: 'hospital_survey', date: '2026-03-17', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'complaint', priority: 'high' }, text: 'Emergency department wait complaint filed. Family reports 5-hour wait for elderly patient with fracture.' },
  { id: 'hp017', source: 'hospital_survey', date: '2026-03-15', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'complaint', priority: 'high' }, text: 'Patient left ER without being seen after 3-hour wait. Escalated to patient safety committee.' },
  { id: 'hp018', source: 'hospital_survey', date: '2026-03-12', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'post-visit', priority: 'high' }, text: 'ER wait time complaint: patient with documented urgent condition waited 45 minutes for triage acknowledgment.' },
  { id: 'hp019', source: 'hospital_survey', date: '2026-03-10', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'complaint', priority: 'high' }, text: 'Multiple formal complaints this week about ER wait times exceeding 4 hours on multiple days.' },
  { id: 'hp020', source: 'hospital_survey', date: '2026-03-07', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'annual', priority: 'high' }, text: 'Annual survey data shows ER satisfaction at all-time low. Wait time is the primary driver of dissatisfaction.' },
  { id: 'hp021', source: 'hospital_survey', date: '2026-03-05', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'complaint', priority: 'high' }, text: 'Formal complaint: emergency wait for pediatric patient with high fever exceeded 3 hours. Unacceptable.' },
  { id: 'hp022', source: 'hospital_survey', date: '2026-03-02', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'post-visit', priority: 'high' }, text: 'Patient advocate flagging ER wait times as a patient safety risk. Requesting formal systemic review.' },
  { id: 'hp023', source: 'hospital_survey', date: '2026-02-28', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'complaint', priority: 'high' }, text: 'ER overcrowding complaint from patient family. 5+ hour wait on a Friday evening. Staff overwhelmed.' },
  { id: 'hp024', source: 'hospital_survey', date: '2026-02-25', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'post-visit', priority: 'medium' }, text: 'Survey feedback: ER triage communication absent during long waits. Patients reported feeling invisible.' },
  { id: 'hp025', source: 'hospital_survey', date: '2026-02-22', cluster: 'Extended Emergency Wait Times', metadata: { survey: 'complaint', priority: 'high' }, text: 'Patient complaint: ER wait time display showed 30 minutes but actual wait was 3+ hours. Misleading.' },

  // ── Cluster: Online Appointment Booking Failures (10 patient_portal, 10 hospital_survey) ─
  { id: 'hp026', source: 'patient_portal', rating: 1, date: '2026-03-19', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.3.0', app: 'CarePoint' }, text: 'Portal crashes on the appointment confirmation screen every single time across 3 different devices.' },
  { id: 'hp027', source: 'patient_portal', rating: 1, date: '2026-03-17', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.3.0', app: 'CarePoint' }, text: 'Got double-booked through the app and showed up to find my slot given to someone else.' },
  { id: 'hp028', source: 'patient_portal', rating: 1, date: '2026-03-14', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.2.1', app: 'CarePoint' }, text: 'No confirmation email after booking. I have no idea if my appointment is real and have to call every time.' },
  { id: 'hp029', source: 'patient_portal', rating: 1, date: '2026-03-11', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.2.1', app: 'CarePoint' }, text: 'Portal timed out and lost all my insurance information. Had to re-enter everything from scratch twice.' },
  { id: 'hp030', source: 'patient_portal', rating: 1, date: '2026-03-08', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.2.1', app: 'CarePoint' }, text: 'App crashes on the final step of booking on both my iPhone and my iPad. Can never complete online.' },
  { id: 'hp031', source: 'patient_portal', rating: 2, date: '2026-03-05', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.2.0', app: 'CarePoint' }, text: 'Calendar sync is broken. My booked appointments do not appear in my phone calendar after confirming.' },
  { id: 'hp032', source: 'patient_portal', rating: 1, date: '2026-03-02', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.2.0', app: 'CarePoint' }, text: 'Portal shows available appointment slots then returns unavailable error when I try to select one.' },
  { id: 'hp033', source: 'patient_portal', rating: 1, date: '2026-02-27', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.2.0', app: 'CarePoint' }, text: 'Session expires too fast during booking. I lost my place in the booking flow 4 times in one day.' },
  { id: 'hp034', source: 'patient_portal', rating: 1, date: '2026-02-24', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.2.0', app: 'CarePoint' }, text: 'Appointment reschedule crashed the portal and cancelled my original booking with no notification.' },
  { id: 'hp035', source: 'patient_portal', rating: 1, date: '2026-02-21', cluster: 'Online Appointment Booking Failures', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'Portal is down more often than it works. I always end up having to call the front desk anyway.' },
  { id: 'hp036', source: 'hospital_survey', date: '2026-03-21', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'complaint', priority: 'high' }, text: 'Patient complaint: double-booked through online portal. Caused distress and a wasted hospital trip.' },
  { id: 'hp037', source: 'hospital_survey', date: '2026-03-18', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'post-visit', priority: 'medium' }, text: 'Survey: portal booking crashes on confirmation screen. Multiple patients reporting the same issue.' },
  { id: 'hp038', source: 'hospital_survey', date: '2026-03-15', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Complaint: no confirmation received after online booking. Patient missed their appointment as a result.' },
  { id: 'hp039', source: 'hospital_survey', date: '2026-03-12', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'it-ticket', priority: 'high' }, text: 'IT ticket: booking portal session timeout causes insurance information loss. High frequency issue.' },
  { id: 'hp040', source: 'hospital_survey', date: '2026-03-09', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'post-visit', priority: 'medium' }, text: 'Survey feedback: appointment portal fails on mobile iOS. Desktop version works but mobile is broken.' },
  { id: 'hp041', source: 'hospital_survey', date: '2026-03-06', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Patient complaint: portal rescheduled their appointment without any notification to the patient.' },
  { id: 'hp042', source: 'hospital_survey', date: '2026-03-03', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'complaint', priority: 'high' }, text: 'Booking system was down for 3 days. Multiple patients unable to book needed follow-up appointments.' },
  { id: 'hp043', source: 'hospital_survey', date: '2026-02-28', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'annual', priority: 'medium' }, text: 'Survey: 78% of respondents reported difficulty with the online booking system last month.' },
  { id: 'hp044', source: 'hospital_survey', date: '2026-02-25', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Patient unable to book specialist appointment online. Error on payment screen blocks completion.' },
  { id: 'hp045', source: 'hospital_survey', date: '2026-02-22', cluster: 'Online Appointment Booking Failures', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Complaint: pediatric appointment booking not available online despite being offered in the clinic.' },

  // ── Cluster: Medical Records Portal Access Issues (20 patient_portal) ─────────
  { id: 'hp046', source: 'patient_portal', rating: 1, date: '2026-03-18', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.3.0', app: 'MyChart' }, text: 'Cannot log into MyChart. Reset my password 3 times and still locked out after each attempt.' },
  { id: 'hp047', source: 'patient_portal', rating: 1, date: '2026-03-16', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.3.0', app: 'MyChart' }, text: 'Test results from 2 weeks ago are still missing from the portal. I need them for a specialist.' },
  { id: 'hp048', source: 'patient_portal', rating: 1, date: '2026-03-13', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.2.1', app: 'MyChart' }, text: 'Portal app crashes immediately on Android. The web version barely works either. Completely unusable.' },
  { id: 'hp049', source: 'patient_portal', rating: 1, date: '2026-03-11', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.2.1', app: 'MyChart' }, text: 'Medication list in the portal is completely wrong. Still showing two discontinued prescriptions.' },
  { id: 'hp050', source: 'patient_portal', rating: 1, date: '2026-03-08', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.2.1', app: 'MyChart' }, text: 'MyChart password reset emails never arrive. Have called IT 3 times and still cannot access my records.' },
  { id: 'hp051', source: 'patient_portal', rating: 1, date: '2026-03-06', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.2.0', app: 'MyChart' }, text: 'Cannot view my discharge summary in the portal. The PDF file simply will not load at all.' },
  { id: 'hp052', source: 'patient_portal', rating: 1, date: '2026-03-03', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.2.0', app: 'MyChart' }, text: 'Portal shows records from 2019 but nothing from any of my last 3 visits this year.' },
  { id: 'hp053', source: 'patient_portal', rating: 1, date: '2026-02-28', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.2.0', app: 'MyChart' }, text: 'Two-factor authentication is completely broken. The SMS verification code never arrives.' },
  { id: 'hp054', source: 'patient_portal', rating: 1, date: '2026-02-25', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.2.0', app: 'MyChart' }, text: 'Session never stays active. The app asks me to log in every single time I open it. Infuriating.' },
  { id: 'hp055', source: 'patient_portal', rating: 1, date: '2026-02-22', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'My allergies list in MyChart is outdated by 2 years. Wrong allergy data is a genuine safety risk.' },
  { id: 'hp056', source: 'patient_portal', rating: 1, date: '2026-02-19', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'Cannot upload required prep documents for my upcoming procedure. Portal upload always fails.' },
  { id: 'hp057', source: 'patient_portal', rating: 2, date: '2026-02-16', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'Portal shows cancelled appointments as active. This is causing real confusion for my care schedule.' },
  { id: 'hp058', source: 'patient_portal', rating: 1, date: '2026-02-13', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'Lab results are cut off on the mobile view. The table is completely unreadable on a phone screen.' },
  { id: 'hp059', source: 'patient_portal', rating: 1, date: '2026-02-10', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'MyChart and the hospital app are not integrated. I have to use two completely separate apps.' },
  { id: 'hp060', source: 'patient_portal', rating: 1, date: '2026-02-07', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'Immunization records not visible in portal at all. Had to request paper copies from the office.' },
  { id: 'hp061', source: 'patient_portal', rating: 1, date: '2026-02-04', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'Portal crashed mid-message while I was writing to my doctor. The entire message was lost.' },
  { id: 'hp062', source: 'patient_portal', rating: 1, date: '2026-02-01', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'My referral records are not showing in the portal and my specialist cannot see them either.' },
  { id: 'hp063', source: 'patient_portal', rating: 1, date: '2026-01-28', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'Patient portal does not work on iOS 17. The app crashes on launch every single time.' },
  { id: 'hp064', source: 'patient_portal', rating: 1, date: '2026-01-25', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'After a system update, all my past visit notes were completely wiped from the portal.' },
  { id: 'hp065', source: 'patient_portal', rating: 1, date: '2026-01-22', cluster: 'Medical Records Portal Access Issues', metadata: { version: '4.1.0', app: 'MyChart' }, text: 'Test results marked "within normal range" are hidden in the portal. I need to see all results.' },

  // ── Cluster: Billing Statement Errors and Confusion (20 hospital_survey) ──────
  { id: 'hp066', source: 'hospital_survey', date: '2026-03-23', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Patient billed for a service they never received. Dispute has been ignored for 3 weeks. No response.' },
  { id: 'hp067', source: 'hospital_survey', date: '2026-03-21', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Insurance pre-authorisation obtained but not applied to bill. Patient billed at full uninsured rate.' },
  { id: 'hp068', source: 'hospital_survey', date: '2026-03-18', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Two separate bills received for the same 3-night hospital stay. Patient does not know which is correct.' },
  { id: 'hp069', source: 'hospital_survey', date: '2026-03-16', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Charged at inpatient rates for a same-day outpatient procedure. Requesting immediate rate correction.' },
  { id: 'hp070', source: 'hospital_survey', date: '2026-03-13', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Bill amount changed between monthly statements without any explanation. Patient requests itemised bill.' },
  { id: 'hp071', source: 'hospital_survey', date: '2026-03-11', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Prior authorisation confirmed but still not reflected on the final bill after 4 phone calls.' },
  { id: 'hp072', source: 'hospital_survey', date: '2026-03-08', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Collection notice received for a bill the patient already paid. Proof of payment has been submitted.' },
  { id: 'hp073', source: 'hospital_survey', date: '2026-03-05', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Portal shows a balance but patient holds a zero-balance letter from their insurer. Cannot resolve online.' },
  { id: 'hp074', source: 'hospital_survey', date: '2026-03-02', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'EOB shows $0 patient responsibility but hospital billed $650 with no explanation of the discrepancy.' },
  { id: 'hp075', source: 'hospital_survey', date: '2026-02-27', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Bill received 8 months post-visit. Insurance says claim was filed incorrectly. Patient held responsible.' },
  { id: 'hp076', source: 'hospital_survey', date: '2026-02-24', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Double charge for lab work. Both in-house and third-party lab billed for the exact same test.' },
  { id: 'hp077', source: 'hospital_survey', date: '2026-02-21', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Incorrect NPI on claim caused insurance denial. Patient incorrectly held responsible for full amount.' },
  { id: 'hp078', source: 'hospital_survey', date: '2026-02-18', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Bill sent to a deceased family member. This is deeply distressing and should not be possible.' },
  { id: 'hp079', source: 'hospital_survey', date: '2026-02-15', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Itemised bill requested 3 times over 6 weeks. Never received. Formal billing dispute now filed.' },
  { id: 'hp080', source: 'hospital_survey', date: '2026-02-12', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Patient billed for a no-show but they attended. Reception confirms the patient was present that day.' },
  { id: 'hp081', source: 'hospital_survey', date: '2026-02-09', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Wrong plan year rates applied by insurance. Patient overcharged by an estimated $400.' },
  { id: 'hp082', source: 'hospital_survey', date: '2026-02-06', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Surprise bill for an out-of-network anaesthesiologist during an in-network surgical procedure.' },
  { id: 'hp083', source: 'hospital_survey', date: '2026-02-03', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Patient billed for interpreter services they did not request and did not receive during their visit.' },
  { id: 'hp084', source: 'hospital_survey', date: '2026-01-30', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Pre-surgical lab work billed separately outside the bundled procedure rate without prior notice.' },
  { id: 'hp085', source: 'hospital_survey', date: '2026-01-27', cluster: 'Billing Statement Errors and Confusion', metadata: { survey: 'complaint', priority: 'high' }, text: 'Billing support line unreachable. Four calls placed, no callback. No online dispute option exists.' },

  // ── Cluster: Staff Praise (5 patient_portal, 5 hospital_survey) ───────────────
  { id: 'hp086', source: 'patient_portal', rating: 5, date: '2026-01-20', cluster: 'Staff Praise', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'The nursing staff were incredibly compassionate during my difficult stay. Truly outstanding care.' },
  { id: 'hp087', source: 'patient_portal', rating: 5, date: '2026-01-15', cluster: 'Staff Praise', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'My care coordinator followed up 3 times after discharge. The level of patient support was exceptional.' },
  { id: 'hp088', source: 'patient_portal', rating: 4, date: '2026-01-10', cluster: 'Staff Praise', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'Despite the long wait, the care team were warm and attentive when they finally saw us.' },
  { id: 'hp089', source: 'patient_portal', rating: 5, date: '2025-12-20', cluster: 'Staff Praise', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'The oncology nurses made an incredibly hard process feel manageable. I am deeply grateful.' },
  { id: 'hp090', source: 'patient_portal', rating: 5, date: '2025-12-10', cluster: 'Staff Praise', metadata: { version: '4.1.0', app: 'CarePoint' }, text: 'Excellent communication from my surgical team throughout. I felt fully informed at every stage.' },
  { id: 'hp091', source: 'hospital_survey', date: '2026-01-18', cluster: 'Staff Praise', metadata: { survey: 'post-visit', priority: 'low' }, text: 'Survey response: 5/5 overall satisfaction. Staff praised for compassionate and professional care.' },
  { id: 'hp092', source: 'hospital_survey', date: '2026-01-13', cluster: 'Staff Praise', metadata: { survey: 'post-visit', priority: 'low' }, text: 'Patient specifically praised the nursing team for going above and beyond during their recovery.' },
  { id: 'hp093', source: 'hospital_survey', date: '2026-01-08', cluster: 'Staff Praise', metadata: { survey: 'post-visit', priority: 'low' }, text: 'Post-discharge feedback: care coordinator follow-up call was genuinely appreciated by the patient.' },
  { id: 'hp094', source: 'hospital_survey', date: '2025-12-15', cluster: 'Staff Praise', metadata: { survey: 'post-visit', priority: 'low' }, text: 'Survey: doctor communication rated 5/5. Patient felt heard, respected, and fully informed.' },
  { id: 'hp095', source: 'hospital_survey', date: '2025-12-05', cluster: 'Staff Praise', metadata: { survey: 'post-visit', priority: 'low' }, text: 'Family praise for the ICU team. Described the level of care as world-class during a critical time.' },

  // ── Cluster: Parking and Facility Issues (5 hospital_survey) ─────────────────
  { id: 'hp096', source: 'hospital_survey', date: '2025-11-20', cluster: 'Parking and Facility Issues', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Parking garage always full for outpatient appointments. Patients with mobility issues are most affected.' },
  { id: 'hp097', source: 'hospital_survey', date: '2025-11-05', cluster: 'Parking and Facility Issues', metadata: { survey: 'complaint', priority: 'low' }, text: 'Cafeteria closes at 6pm but visiting hours run until 9pm. Family members visiting after work have no food.' },
  { id: 'hp098', source: 'hospital_survey', date: '2025-10-20', cluster: 'Parking and Facility Issues', metadata: { survey: 'complaint', priority: 'medium' }, text: 'Main entrance wheelchair ramp was blocked by construction equipment for 3 consecutive weeks.' },
  { id: 'hp099', source: 'hospital_survey', date: '2025-10-05', cluster: 'Parking and Facility Issues', metadata: { survey: 'complaint', priority: 'medium' }, text: 'No clear signage for the new oncology wing. Multiple patients reported getting lost on arrival.' },
  { id: 'hp100', source: 'hospital_survey', date: '2025-09-15', cluster: 'Parking and Facility Issues', metadata: { survey: 'complaint', priority: 'high' }, text: 'Only 2 accessible parking spaces for a major hospital. Completely inadequate for patient volume.' },
]

// ─── Hospital Trends Chart Data (monthly Sep 2025–Mar 2026, ~310 total) ────────
// Keys intentionally match CHART_DATA shape so Trends.tsx chart code is reused;
// legend labels are swapped in the component (Patient Portal / Hospital Survey).

export const HOSPITAL_CHART_DATA: Record<string, { label: string; appStore: number; supportTickets: number }[]> = {
  '7d': [
    { label: 'Mar 14', appStore: 5,  supportTickets:3 },
    { label: 'Mar 15', appStore: 6,  supportTickets:4 },
    { label: 'Mar 16', appStore: 4,  supportTickets:3 },
    { label: 'Mar 17', appStore: 7,  supportTickets:5 },
    { label: 'Mar 18', appStore: 8,  supportTickets:6 },
    { label: 'Mar 19', appStore: 9,  supportTickets:7 },
    { label: 'Mar 20', appStore: 10, supportTickets:7 },
  ],
  '30d': [
    { label: 'Feb 21', appStore: 22, supportTickets:17 },
    { label: 'Feb 28', appStore: 26, supportTickets:20 },
    { label: 'Mar 7',  appStore: 31, supportTickets:24 },
    { label: 'Mar 14', appStore: 37, supportTickets:28 },
    { label: 'Mar 20', appStore: 39, supportTickets:31 },
  ],
  '90d': [
    { label: 'Wk 1',  appStore: 8,  supportTickets:5  },
    { label: 'Wk 2',  appStore: 10, supportTickets:7  },
    { label: 'Wk 3',  appStore: 9,  supportTickets:7  },
    { label: 'Wk 4',  appStore: 12, supportTickets:9  },
    { label: 'Wk 5',  appStore: 13, supportTickets:10 },
    { label: 'Wk 6',  appStore: 15, supportTickets:11 },
    { label: 'Wk 7',  appStore: 16, supportTickets:12 },
    { label: 'Wk 8',  appStore: 18, supportTickets:14 },
    { label: 'Wk 9',  appStore: 20, supportTickets:15 },
    { label: 'Wk 10', appStore: 22, supportTickets:17 },
    { label: 'Wk 11', appStore: 28, supportTickets:22 },
    { label: 'Wk 12', appStore: 34, supportTickets:26 },
  ],
  '1y': [
    { label: 'Sep',   appStore: 16, supportTickets:12 },
    { label: 'Oct',   appStore: 20, supportTickets:16 },
    { label: 'Nov',   appStore: 23, supportTickets:19 },
    { label: 'Dec',   appStore: 27, supportTickets:21 },
    { label: 'Jan',   appStore: 33, supportTickets:27 },
    { label: 'Feb',   appStore: 35, supportTickets:27 },
    { label: 'Mar',   appStore: 20, supportTickets:14 },
  ],
}

export const HOSPITAL_TRENDS_METRICS = [
  {
    id: '1', name: 'Total Feedback Volume',
    currentValue: 310, previousValue: 248, change: 25.0, trend: 'up' as const,
    unit: '', positiveIsGood: false,
    sparkline: [40, 45, 48, 52, 56, 60, 65, 68, 72, 78, 84, 88, 93, 97, 100],
  },
  {
    id: '2', name: 'Avg Confidence Score',
    currentValue: 81, previousValue: 78, change: 3.8, trend: 'up' as const,
    unit: '%', positiveIsGood: true,
    sparkline: [70, 71, 71, 72, 73, 73, 74, 75, 76, 77, 78, 79, 80, 80, 81],
  },
  {
    id: '3', name: 'Evidence Clusters',
    currentValue: 4, previousValue: 4, change: 0, trend: 'stable' as const,
    unit: '', positiveIsGood: true,
    sparkline: [50, 50, 75, 75, 75, 75, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  },
  {
    id: '4', name: 'Analyzed',
    currentValue: 89, previousValue: 84, change: 6.0, trend: 'up' as const,
    unit: '%', positiveIsGood: true,
    sparkline: [70, 72, 73, 74, 76, 77, 78, 79, 81, 82, 84, 85, 87, 88, 89],
  },
  {
    id: '5', name: 'Cache Hit Rate',
    currentValue: 89, previousValue: 82, change: 8.5, trend: 'up' as const,
    unit: '%', positiveIsGood: true,
    sparkline: [65, 67, 68, 70, 72, 74, 76, 78, 80, 82, 84, 85, 87, 88, 89],
  },
  {
    id: '6', name: 'Avg Cluster Confidence',
    currentValue: 81, previousValue: 78, change: 3.8, trend: 'up' as const,
    unit: '%', positiveIsGood: true,
    sparkline: [70, 71, 72, 72, 73, 74, 75, 75, 76, 77, 78, 79, 80, 80, 81],
  },
]

// ─── Hospital Themes (compatible with ThemeItem interface in Themes.tsx) ────────

export const HOSPITAL_THEMES = [
  {
    id: 'h1', clusterId: 'hev-001',
    name: 'Extended Emergency Wait Times',
    description: 'Patients reporting 3–6 hour ER waits with no staff updates — triage system overwhelmed, portal wait-time display inaccurate',
    feedbackCount: 98, uniqueUsers: 87, confidence: 91,
    sentiment: 'negative' as const, trend: 'rising' as const,
    keywords: ['ER wait', 'triage', 'emergency', 'overcrowding', 'no communication'],
    color: 'bg-red-500', sources: ['Patient Portal', 'Hospital Survey'],
    category: 'UX' as const,
    representativeQuotes: [
      'Waited 4 hours in the ER with chest pain. No updates or acknowledgment from any staff.',
      'App showed 30-minute ER wait but we waited 4+ hours. The wait time display is completely false.',
      'ER wait times have doubled this year. My family has experienced this 3 times.',
    ],
  },
  {
    id: 'h2', clusterId: 'hev-002',
    name: 'Online Appointment Booking Failures',
    description: 'Booking portal crashes on confirmation, double-books slots, and sends no confirmation emails — session timeouts lose all entered insurance data',
    feedbackCount: 76, uniqueUsers: 71, confidence: 84,
    sentiment: 'negative' as const, trend: 'stable' as const,
    keywords: ['booking', 'portal crash', 'double-booked', 'confirmation', 'session timeout'],
    color: 'bg-orange-500', sources: ['Patient Portal', 'Hospital Survey'],
    category: 'Technical' as const,
    representativeQuotes: [
      'Booking portal crashes every time I try to confirm my appointment. Tried 3 different phones.',
      'Got double-booked through the online system twice in one month.',
      'No confirmation email after booking. I call the hospital to verify every appointment I make.',
    ],
  },
  {
    id: 'h3', clusterId: 'hev-003',
    name: 'Billing Statement Errors and Confusion',
    description: 'Insurance pre-approvals not applied, duplicate charges, and 45-minute hold times for billing support — dispute resolution takes months with no acknowledgement',
    feedbackCount: 82, uniqueUsers: 58, confidence: 78,
    sentiment: 'negative' as const, trend: 'stable' as const,
    keywords: ['billing', 'insurance', 'overcharge', 'dispute', 'statement error'],
    color: 'bg-blue-400', sources: ['Hospital Survey'],
    category: 'Feature' as const,
    representativeQuotes: [
      'Insurance was pre-approved but not applied. Billed at full uninsured rate.',
      'Two separate bills arrived for the same hospital stay with different amounts.',
      'Bill dispute filed 30 days ago. No response, no acknowledgement, no contact.',
    ],
  },
  {
    id: 'h4', clusterId: 'hev-004',
    name: 'Medical Records Portal Access Issues',
    description: 'MyChart login failures, Android app crash on launch, test results missing after 48h SLA, outdated medication records creating potential safety risk',
    feedbackCount: 54, uniqueUsers: 44, confidence: 72,
    sentiment: 'negative' as const, trend: 'declining' as const,
    keywords: ['MyChart', 'login failure', 'records access', 'Android crash', 'test results'],
    color: 'bg-violet-500', sources: ['Patient Portal'],
    category: 'Technical' as const,
    representativeQuotes: [
      'Cannot log into MyChart. Reset password three times. Still locked out.',
      'Test results were supposed to appear within 48 hours. Still missing after 2 weeks.',
      'Portal app crashes immediately on Android. Web version is very slow.',
    ],
  },
]

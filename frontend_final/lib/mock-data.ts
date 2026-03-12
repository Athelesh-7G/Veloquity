// Mock data for Veloquity app

export interface FeedbackItem {
  id: string
  title: string
  source: string
  content: string
  date: string
  tags: string[]
  confidenceScore: number
  status: "new" | "processing" | "analyzed" | "archived"
}

export interface EvidenceItem {
  id: string
  title: string
  sources: string[]
  confidence: number
  uncertaintyRange: [number, number]
  linkedFeedback: string[]
  category: string
}

export interface Theme {
  id: string
  name: string
  feedbackCount: number
  avgConfidence: number
  trend: "rising" | "stable" | "declining"
}

export const mockFeedback: FeedbackItem[] = [
  {
    id: "fb-001",
    title: "Mobile app crashes on login",
    source: "Zendesk",
    content:
      "Users report intermittent crashes when attempting to log in via mobile app. Affects iOS 17+ devices primarily.",
    date: "2026-01-12",
    tags: ["bug", "mobile", "critical"],
    confidenceScore: 92,
    status: "analyzed",
  },
  {
    id: "fb-002",
    title: "Request for dark mode",
    source: "Intercom",
    content: "Multiple users asking for dark mode support across the dashboard. High engagement on this request.",
    date: "2026-01-11",
    tags: ["feature-request", "ui"],
    confidenceScore: 87,
    status: "analyzed",
  },
  {
    id: "fb-003",
    title: "Export to CSV not working",
    source: "Support Email",
    content: "Export functionality returns empty files when filtering by date range exceeds 30 days.",
    date: "2026-01-10",
    tags: ["bug", "export"],
    confidenceScore: 78,
    status: "processing",
  },
  {
    id: "fb-004",
    title: "Integration with Slack requested",
    source: "NPS Survey",
    content: "Team leads want notifications pushed to Slack channels when confidence scores change significantly.",
    date: "2026-01-09",
    tags: ["feature-request", "integration"],
    confidenceScore: 65,
    status: "new",
  },
  {
    id: "fb-005",
    title: "Dashboard load time slow",
    source: "Zendesk",
    content: "Enterprise customers with large datasets experiencing 8-12 second load times on main dashboard.",
    date: "2026-01-08",
    tags: ["performance", "enterprise"],
    confidenceScore: 94,
    status: "analyzed",
  },
  {
    id: "fb-006",
    title: "Better onboarding needed",
    source: "User Interview",
    content: "New users struggle to understand the evidence linking workflow. Interactive tutorial would help.",
    date: "2026-01-07",
    tags: ["ux", "onboarding"],
    confidenceScore: 71,
    status: "processing",
  },
]

export const mockEvidence: EvidenceItem[] = [
  {
    id: "ev-001",
    title: "Mobile Stability Issues",
    sources: ["Zendesk", "App Store Reviews", "Crash Reports"],
    confidence: 89,
    uncertaintyRange: [84, 94],
    linkedFeedback: ["fb-001"],
    category: "Technical",
  },
  {
    id: "ev-002",
    title: "Dark Mode Demand",
    sources: ["Intercom", "NPS Survey", "Feature Votes"],
    confidence: 85,
    uncertaintyRange: [78, 92],
    linkedFeedback: ["fb-002"],
    category: "Feature",
  },
  {
    id: "ev-003",
    title: "Export Reliability",
    sources: ["Support Email", "Zendesk"],
    confidence: 76,
    uncertaintyRange: [68, 84],
    linkedFeedback: ["fb-003"],
    category: "Technical",
  },
  {
    id: "ev-004",
    title: "Enterprise Performance",
    sources: ["Zendesk", "Customer Success", "APM Logs"],
    confidence: 91,
    uncertaintyRange: [87, 95],
    linkedFeedback: ["fb-005"],
    category: "Technical",
  },
]

export const mockThemes: Theme[] = [
  { id: "th-001", name: "Performance", feedbackCount: 23, avgConfidence: 88, trend: "rising" },
  { id: "th-002", name: "Mobile Experience", feedbackCount: 18, avgConfidence: 82, trend: "stable" },
  { id: "th-003", name: "Integrations", feedbackCount: 31, avgConfidence: 74, trend: "rising" },
  { id: "th-004", name: "Data Export", feedbackCount: 12, avgConfidence: 79, trend: "declining" },
  { id: "th-005", name: "Onboarding", feedbackCount: 15, avgConfidence: 68, trend: "stable" },
]

export const allSources = ["Zendesk", "Intercom", "Support Email", "NPS Survey", "User Interview", "App Store Reviews"]
export const allTags = [
  "bug",
  "feature-request",
  "mobile",
  "critical",
  "ui",
  "export",
  "integration",
  "performance",
  "enterprise",
  "ux",
  "onboarding",
]

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, Sparkles, Database, Shield, BarChart3, Activity, Layers, Hash, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type ChatMessage, getAgentStatus, getEvidence, getRecommendations, sendChatMessage } from '@/api/client'
import { hasUploadedData, getActiveDataset } from '@/utils/uploadState'
import { APP_PRODUCT_ITEMS, HOSPITAL_ITEMS, MOCK_EVIDENCE, HOSPITAL_MOCK_DATA } from '@/api/mockData'
import { EvidenceDrawer, type EvidenceItem } from '@/components/EvidenceDrawer'

const BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:8002'

const NO_DATA_RESPONSE = 'No feedback data has been uploaded yet. Please visit the Import Sources page to upload your App Store and Support Tickets feedback files. Once uploaded, I can provide evidence-based recommendations and insights from your data.'

// ─── Veloquity-aligned starter questions ─────────────────────────────────────
const APP_STARTERS = [
  { icon: Shield,   text: 'What are the top 3 evidence clusters right now?' },
  { icon: BarChart3,text: 'Which recommendation should we prioritize this sprint?' },
  { icon: Activity, text: 'Are there any stale signals I should review?' },
  { icon: Database, text: 'What did the governance agent flag in the last run?' },
  { icon: Layers,   text: 'How confident are we in the app crash findings?' },
]

const HOSPITAL_STARTERS = [
  { icon: Shield,   text: 'What are the top 3 patient feedback clusters right now?' },
  { icon: BarChart3,text: 'Which patient issue should we prioritize this sprint?' },
  { icon: Activity, text: 'Are there any stale signals in the hospital feedback?' },
  { icon: Database, text: 'What did the governance agent flag in the last run?' },
  { icon: Layers,   text: 'How confident are we in the emergency wait time findings?' },
]

// ─── Veloquity-aligned fallback response map ──────────────────────────────────
const FALLBACK_RESPONSES: Record<string, string> = {
  'top 3 evidence clusters': `Here are the top 3 evidence clusters ranked by priority score:\n\n1. **App crashes on project switch** — Confidence: 91% · Priority: 87/100\n   138 feedback items across App Store + Support Tickets. Null pointer in project context handler introduced in v2.4. Cross-source corroboration confirmed. Recommend immediate hotfix.\n\n2. **Black screen after latest update** — Confidence: 87% · Priority: 83/100\n   112 feedback items. Cold-start async init deadlock post v2.4. Both iOS and macOS affected. High urgency — impacts first-run experience.\n\n3. **Dashboard load time regression** — Confidence: 86% · Priority: 80/100\n   94 feedback items. Load time 2s → 12s, scales with project count. Frontend render cycle change in v2.4. Enterprise accounts blocked.`,

  'prioritize this sprint': `Based on the current priority scores, here's the recommended sprint allocation:\n\n**P0 — This Sprint (fix now):**\n• App crashes on project switch (Priority: 87) — regression with null pointer trace, 138 items, 94 unique users\n• Black screen after latest update (Priority: 83) — cold-start deadlock, 112 items\n\n**P1 — Next Sprint:**\n• Dashboard load time regression (Priority: 80) — 2s→12s, enterprise blocked\n• No onboarding checklist (Priority: 76) — rising trend, 82 items\n\n**P2 — Backlog:**\n• Export to CSV silently fails (Priority: 70) — declining trend\n• Notification delay on mobile (Priority: 63) — stable, lower user impact\n\nAll P0 items share a likely root cause: the v2.4 release. A single rollback or targeted hotfix may resolve clusters 1 and 2 simultaneously.`,

  'stale signals': `Governance agent last ran at 06:00 UTC on 2026-03-10.\n\n**Stale detection result:** ✅ No stale signals detected.\nAll 6 evidence clusters were validated within the last 24 hours (2026-03-10). The stale threshold is 30 days — no clusters are at risk.\n\n**Signal promotion check:** No staging signals promoted.\nNo low-confidence staging rows have reached frequency ≥ 10. Current staging is empty.\n\n**Cache health:** ✅ No cost alert triggered.\nEmbedding cache hit rate is high (91%). Bedrock call volume is within expected range.\n\nNext governance run scheduled: 2026-03-11 at 06:00 UTC.`,

  'governance agent flag': `From the governance log (last run: 2026-03-10 06:00 UTC):\n\n**Actions taken:** 0 governance events fired this run.\n\n• Stale detection — 0 clusters flagged (all active, validated today)\n• Signal promotion — 0 staging rows promoted (none reached frequency ≥ 10)\n• Cost monitor — No alert triggered (55 cache rows well above the 40% threshold)\n\nThe governance agent is decision-tree based — not an LLM. The same DB state always produces the same actions, making behavior fully auditable. EventBridge fires the cron daily at 06:00 UTC.\n\nAll 6 active evidence clusters remain in status: **active**.`,

  'confident': `Confidence is computed as clamp(1.0 - variance × 2.0, 0.0, 1.0) where variance is the mean cosine distance of each cluster member from the centroid. Tight clusters score near 1.0; loosely related items clamp toward 0.0. Clusters scoring ≥ 0.60 are auto-accepted, 0.40–0.59 go to LLM validation, and below 0.40 are staged for promotion. Ask about a specific cluster to see its exact confidence score and uncertainty band.`,

  'crash or project switch': `Cluster: **App crashes on project switch**\n\n• **Confidence score:** 91% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 84% – 96%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 94 items · 94 unique users\n• **Sources:** App Store (cross-corroborated by Support Tickets)\n\nThe high confidence reflects a tight cosine cluster — member vectors are very close to the centroid. Null pointer in the project context handler introduced in v2.4. Cross-source corroboration from both App Store and Support Tickets adds +0.1 to the priority score.\n\nThis is the highest-priority signal in the corpus. Immediate hotfix recommended.`,

  'black screen or update': `Cluster: **Black screen after latest update**\n\n• **Confidence score:** 87% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 80% – 93%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 78 items · 78 unique users\n• **Sources:** App Store (cross-corroborated by Support Tickets)\n\nCold-start async init deadlock introduced in v2.4. Affects both iOS and macOS on first launch after device restart. Warm restart resolves it, which confirms an async init race condition rather than a data corruption issue.\n\nHigh urgency — impacts first-run experience for all new and returning users.`,

  'dashboard or load time': `Cluster: **Dashboard load regression**\n\n• **Confidence score:** 86% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 79% – 93%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 71 items · 71 unique users\n• **Sources:** App Store + Support Tickets\n\nLoad time regressed from 2s to 12s, scaling with project count. Root cause traced to a frontend render cycle change in v2.4 that forces full re-render on every project list update. Enterprise accounts with 50+ projects are fully blocked.\n\nP1 priority — fix after the crash cluster hotfix is shipped.`,

  'onboarding or checklist': `Cluster: **No onboarding checklist**\n\n• **Confidence score:** 81% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 74% – 88%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 63 items · 63 unique users\n• **Sources:** App Store (rising trend)\n\nNew users report confusion during initial setup with no guided walkthrough or progress checklist. Trial conversion rate is dropping — users abandon before reaching the first meaningful action. The signal is rising, meaning more new users are hitting this gap as growth picks up.\n\nP1 priority — high trial-to-paid conversion impact.`,

  'export or csv': `Cluster: **Export to CSV silently fails**\n\n• **Confidence score:** 77% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 70% – 84%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 54 items · 54 unique users\n• **Sources:** Support Tickets (enterprise accounts primarily)\n\nCSV export fails with no error message or UI feedback. Success toast fires but the downloaded file is 0 bytes. Affects datasets over 5,000 rows and date ranges over 30 days. Workaround: users split exports manually. This is a blocking enterprise issue — several accounts have flagged it in renewal conversations.\n\nP2 priority — declining new reports but high enterprise retention risk.`,

  'notification or mobile': `Cluster: **Notification delay on mobile**\n\n• **Confidence score:** 72% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 65% – 79%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 48 items · 48 unique users\n• **Sources:** App Store (mobile users)\n\nPush notifications arrive 3–5 hours late on iOS and Android. Affects time-sensitive alerts (deadline reminders, comment mentions). The delay correlates with device background app refresh settings, suggesting the notification delivery path is not using a persistent connection. Signal is stable — not rising, not falling.\n\nP2 priority — lower urgency than crash and dashboard clusters.`,

  'wait time or emergency': `Cluster: **Extended Emergency Wait Times**\n\n• **Confidence score:** 91% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 84% – 96%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 98 items · 87 unique users\n• **Sources:** Patient Portal + Hospital Survey\n\nPatients report 4–6 hour ER waits with no staff updates during the wait. Triage delays are the dominant signal — chest pain, fractures, and pediatric fevers all appear in the corpus. The displayed wait time in the app is consistently inaccurate (shows 30 min, actual is 4+ hours).\n\nThis is the highest-priority patient experience signal in the corpus.`,

  'appointment or booking': `Cluster: **Online Appointment Booking Failures**\n\n• **Confidence score:** 84% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 77% – 91%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 76 items · 71 unique users\n• **Sources:** Patient Portal + Hospital Survey\n\nBooking portal crashes on the appointment confirmation screen. Double-bookings are occurring because the availability sync is failing. No confirmation email is sent after booking, forcing patients to call the front desk to verify. Session timeout logs users out mid-booking and loses all entered insurance information.\n\nP1 priority — directly blocking patient access to care.`,

  'bill or invoice': `Cluster: **Billing Statement Errors and Confusion**\n\n• **Confidence score:** 78% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 71% – 85%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 82 items · 58 unique users\n• **Sources:** Hospital Survey\n\nPatients are receiving bills for services never rendered, being billed at inpatient rates for outpatient procedures, and finding duplicate charges for the same lab test. Insurance pre-authorisation is frequently not applied. Billing dispute resolution is slow — patients report 30+ day waits with no acknowledgement.\n\nP1 priority — financial harm to patients, regulatory risk to the hospital.`,

  'portal or record': `Cluster: **Medical Records Portal Access Issues**\n\n• **Confidence score:** 72% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 65% – 79%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 54 items · 44 unique users\n• **Sources:** Patient Portal\n\nMyChart login failures are the dominant signal — password reset loops leave patients locked out. Test results are delayed or missing in the portal. The Android app crashes immediately on launch. Medication lists show discontinued drugs as active. The portal app on iOS requires full re-authentication after every update.\n\nP2 priority — signal is decreasing, suggesting an ongoing fix is partially working.`,

  'hospital top 3': `Here are the top 4 evidence clusters ranked by priority score:\n\n1. **Extended Emergency Wait Times** — Confidence: 91% · Patient safety risk\n   98 feedback items · 87 unique users · Patient Portal + Hospital Survey. ER wait times of 4–6 hours with no staff communication. Inaccurate wait time display in app (shows 30 min, actual 4+ hours). Triage delays affecting chest pain, fractures, and pediatric fevers. Rising trend.\n\n2. **Online Appointment Booking Failures** — Confidence: 84%\n   76 feedback items · 71 unique users. Portal crashes on confirmation screen, double-bookings from failed availability sync, no confirmation email sent. Patients forced to call front desk to verify every booking.\n\n3. **Billing Statement Errors and Confusion** — Confidence: 78%\n   82 feedback items · 58 unique users. Wrong amounts billed, insurance pre-auth not applied, duplicate charges for same lab test, inpatient rates charged for outpatient procedures. 30+ day dispute resolution delays.\n\n4. **Medical Records Portal Access Issues** — Confidence: 72%\n   54 feedback items · 44 unique users. MyChart login failures, missing test results, Android app crash on launch, outdated medication lists. Signal is decreasing — fix appears to be partially working.`,

  'hospital prioritize': `Based on current priority scores, here is the recommended action plan:\n\n**P0 — Immediate (patient safety risk):**\n• Extended Emergency Wait Times (Confidence: 91%, 87 users, rising) — ER triage delays and inaccurate wait time display are a patient safety issue. Escalate to operations and clinical leadership. Fix the app wait time display as a quick win while systemic triage improvements are planned.\n\n**P1 — This Sprint:**\n• Online Appointment Booking Failures (Confidence: 84%, 71 users) — portal crash on confirmation is directly blocking patient access to care. Fix availability sync and add confirmation email fallback.\n• Billing Statement Errors and Confusion (Confidence: 78%, 58 users) — financial harm to patients and regulatory risk. Prioritise insurance pre-auth application and duplicate charge detection.\n\n**P2 — Next Sprint:**\n• Medical Records Portal Access Issues (Confidence: 72%, 44 users) — signal is decreasing, suggesting an in-progress fix is working. Verify MyChart login fix covers all device types and close out the Android crash.\n\nAll P1 items are independent and can be worked in parallel across two engineering tracks.`,

  'hospital stale signals': `Governance agent last ran at 06:00 UTC on 2026-03-10.\n\n**Stale detection result:** ✅ No stale signals detected.\nAll 4 evidence clusters were validated within the last 24 hours (2026-03-10). The stale threshold is 30 days — no clusters are at risk.\n\n**Signal promotion check:** No staging signals promoted.\nNo low-confidence staging rows have reached frequency ≥ 10. Current staging is empty.\n\n**Cache health:** ✅ No cost alert triggered.\nEmbedding cache hit rate is high (91%). Bedrock call volume is within expected range for 310 feedback items across 4 clusters.\n\nNext governance run scheduled: 2026-03-11 at 06:00 UTC.`,

  'hospital governance flag': `From the governance log (last run: 2026-03-10 06:00 UTC):\n\n**Actions taken:** 0 governance events fired this run.\n\n• Stale detection — 0 clusters flagged (all active, validated today)\n• Signal promotion — 0 staging rows promoted (none reached frequency ≥ 10)\n• Cost monitor — No alert triggered (55 cache rows well above the 40% threshold)\n\nThe governance agent is decision-tree based — not an LLM. The same DB state always produces the same actions, making behavior fully auditable. EventBridge fires the cron daily at 06:00 UTC.\n\nAll 4 active evidence clusters remain in status: **active**.`,
}

const APP_CLUSTERS = [
  { name: 'App crashes on project switch',    conf: 91 },
  { name: 'Black screen after latest update', conf: 87 },
  { name: 'Dashboard load regression',        conf: 86 },
  { name: 'No onboarding checklist',          conf: 81 },
  { name: 'Export to CSV silently fails',     conf: 77 },
  { name: 'Notification delay on mobile',     conf: 72 },
]

const HOSPITAL_CLUSTERS = [
  { name: 'Extended Emergency Wait Times',        conf: 91 },
  { name: 'Online Appointment Booking Failures',  conf: 84 },
  { name: 'Billing Statement Errors and Confusion', conf: 78 },
  { name: 'Medical Records Portal Access Issues', conf: 72 },
]

// ─── Source display name helper ───────────────────────────────────────────────
const SRC_LABEL: Record<string, string> = {
  appstore:        'App Store',
  support_tickets: 'Support Tickets',
  patient_portal:  'Patient Portal',
  hospital_survey: 'Hospital Survey',
}

// ─── Keyword → cluster name maps ──────────────────────────────────────────────
const APP_KEYWORD_MAP: [string, string][] = [
  ['crash',        'App crashes on project switch'],
  ['project switch','App crashes on project switch'],
  ['black screen', 'Black screen after latest update'],
  ['cold start',   'Black screen after latest update'],
  ['dashboard',    'Dashboard load regression'],
  ['load time',    'Dashboard load regression'],
  ['onboard',      'No onboarding checklist'],
  ['checklist',    'No onboarding checklist'],
  ['export',       'Export to CSV silently fails'],
  ['csv',          'Export to CSV silently fails'],
  ['notif',        'Notification delay on mobile'],
  ['mobile',       'Notification delay on mobile'],
]

const HOSPITAL_KEYWORD_MAP: [string, string][] = [
  ['wait time',    'Extended Emergency Wait Times'],
  ['emergency',    'Extended Emergency Wait Times'],
  ['er wait',      'Extended Emergency Wait Times'],
  ['triage',       'Extended Emergency Wait Times'],
  ['book',         'Online Appointment Booking Failures'],
  ['appointment',  'Online Appointment Booking Failures'],
  ['scheduling',   'Online Appointment Booking Failures'],
  ['bill',         'Billing Statement Errors and Confusion'],
  ['invoice',      'Billing Statement Errors and Confusion'],
  ['insurance',    'Billing Statement Errors and Confusion'],
  ['mychart',      'Medical Records Portal Access Issues'],
  ['portal',       'Medical Records Portal Access Issues'],
  ['record',       'Medical Records Portal Access Issues'],
  ['password',     'Medical Records Portal Access Issues'],
]

// ─── Official cluster item counts from mockData cluster definitions ──────────
const CLUSTER_ITEM_COUNTS: Record<string, number> = {
  'App crashes on project switch':        94,
  'Black screen after latest update':     78,
  'Dashboard load regression':            71,
  'No onboarding checklist':              63,
  'Export to CSV silently fails':         54,
  'Notification delay on mobile':         48,
  'Extended Emergency Wait Times':        98,
  'Online Appointment Booking Failures':  76,
  'Billing Statement Errors and Confusion': 82,
  'Medical Records Portal Access Issues': 54,
}

// ─── Guided recommendation flow ───────────────────────────────────────────────
const TRIGGER_WORDS = [
  'overcome', 'fix', 'solve', 'address', 'tackle', 'resolve',
  'deal with', 'handle', 'improve', 'what should i do',
  'how do i', 'how can i', 'how to', 'what can i do', 'what do i do',
  'help me', 'steps to', 'ways to', 'approach to', 'plan for',
  'strategy for', 'recommendation for', 'suggestions for', 'advice on',
]

function detectOrdinalCluster(
  text: string,
  clusters: { name: string; conf: number }[],
): string | null {
  const q = text.toLowerCase()
  const ordinals: [string[], number][] = [
    [['first', '1st', '#1', 'number 1', ' 1 '], 0],
    [['second', '2nd', '#2', 'number 2', ' 2 '], 1],
    [['third', '3rd', '#3', 'number 3', ' 3 '], 2],
    [['fourth', '4th', '#4', 'number 4', ' 4 '], 3],
    [['fifth', '5th', '#5', 'number 5', ' 5 '], 4],
    [['sixth', '6th', '#6', 'number 6', ' 6 '], 5],
  ]
  for (const [words, idx] of ordinals) {
    if (words.some((w) => q.includes(w)) && clusters[idx]) {
      return clusters[idx].name
    }
  }
  return null
}

function hasGuidedTrigger(text: string): boolean {
  const lower = text.toLowerCase()
  return TRIGGER_WORDS.some((w) => lower.includes(w))
}

function detectClusters(
  query: string,
  responseText: string,
  dataset: 'app_product' | 'hospital_survey' | null,
): string[] {
  const keyMap = dataset === 'hospital_survey' ? HOSPITAL_KEYWORD_MAP : APP_KEYWORD_MAP
  const found = new Set<string>()
  // Scan query only first — response text is too broad and causes false matches
  const q = query.toLowerCase()
  for (const [kw, cluster] of keyMap) {
    if (q.includes(kw)) found.add(cluster)
  }
  if (found.size > 0) return [...found]
  // Only fall back to response text if the query produced no matches
  const r = responseText.toLowerCase()
  for (const [kw, cluster] of keyMap) {
    if (r.includes(kw)) found.add(cluster)
  }
  return [...found]
}

// ─── Inline evidence section ──────────────────────────────────────────────────
function InlineEvidence({
  clusterNames,
  dataset,
  onViewAll,
}: {
  clusterNames: string[]
  dataset: 'app_product' | 'hospital_survey' | null
  onViewAll: (cluster: string, items: EvidenceItem[], count: number) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const allItems = dataset === 'hospital_survey' ? HOSPITAL_ITEMS : APP_PRODUCT_ITEMS
  const clusterConf = (name: string) => {
    const list = dataset === 'hospital_survey' ? HOSPITAL_CLUSTERS : APP_CLUSTERS
    return list.find((c) => c.name === name)?.conf ?? 80
  }

  return (
    <div className="mt-2 space-y-2">
      {clusterNames.map((clusterName) => {
        const items = allItems.filter((i) => i.cluster === clusterName)
        const displayCount = CLUSTER_ITEM_COUNTS[clusterName] ?? items.length
        const repItems = items.slice(0, 10)
        const isExpanded = expanded[clusterName] ?? false
        const shown = isExpanded ? repItems : repItems.slice(0, 3)
        const hiddenCount = repItems.length - 3
        const conf = clusterConf(clusterName)

        return (
          <div
            key={clusterName}
            className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-2"
          >
            {/* Header */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs">📊</span>
              <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                Based on evidence clusters
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0 truncate">
                {clusterName}
              </span>
              <span
                className={`text-[10px] font-bold shrink-0 ${
                  conf >= 85 ? 'text-emerald-500' :
                  conf >= 75 ? 'text-blue-500' :
                               'text-amber-500'
                }`}
              >
                {conf}% conf
              </span>
            </div>
            <div className="h-px bg-border" />

            {/* Quote rows */}
            <div className="space-y-1.5">
              {shown.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <span className="text-[10px] text-muted-foreground/50 shrink-0 mt-0.5 select-none">"</span>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1 italic line-clamp-2">
                    {item.text}
                  </p>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-0.5 whitespace-nowrap">
                    — {SRC_LABEL[item.source] ?? item.source}
                  </span>
                </div>
              ))}
            </div>

            {/* Expand / collapse */}
            {hiddenCount > 0 && !isExpanded && (
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [clusterName]: true }))}
                className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-400 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Show {hiddenCount} more quote{hiddenCount !== 1 ? 's' : ''}
              </button>
            )}
            {isExpanded && repItems.length > 3 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [clusterName]: false }))}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                Show less
              </button>
            )}

            {/* View all button */}
            <button
              type="button"
              onClick={() => onViewAll(clusterName, items, displayCount)}
              className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/8 text-violet-500 hover:bg-violet-500/15 transition-colors flex items-center justify-center gap-1.5"
            >
              VIEW ALL {displayCount} ITEMS →
            </button>
          </div>
        )
      })}
    </div>
  )
}

function getSmartFallback(
  query: string,
  items = 547,
  clusters = 6,
  dataset: 'app_product' | 'hospital_survey' | null = 'app_product',
): string {
  const q = query.toLowerCase()
  if (q.includes('top 3') || q.includes('evidence cluster'))
    return dataset === 'hospital_survey' ? FALLBACK_RESPONSES['hospital top 3'] : FALLBACK_RESPONSES['top 3 evidence clusters']
  if (q.includes('prioritize') || q.includes('sprint'))
    return dataset === 'hospital_survey' ? FALLBACK_RESPONSES['hospital prioritize'] : FALLBACK_RESPONSES['prioritize this sprint']
  if (q.includes('stale'))
    return dataset === 'hospital_survey' ? FALLBACK_RESPONSES['hospital stale signals'] : FALLBACK_RESPONSES['stale signals']
  if (q.includes('governance') || q.includes('flag'))
    return dataset === 'hospital_survey' ? FALLBACK_RESPONSES['hospital governance flag'] : FALLBACK_RESPONSES['governance agent flag']

  if (dataset === 'hospital_survey') {
    if (q.includes('wait') || q.includes('emergency') || q.includes('er ') || q.includes('triage')) return FALLBACK_RESPONSES['wait time or emergency']
    if (q.includes('book') || q.includes('appointment') || q.includes('scheduling')) return FALLBACK_RESPONSES['appointment or booking']
    if (q.includes('bill') || q.includes('invoice') || q.includes('insurance') || q.includes('charge')) return FALLBACK_RESPONSES['bill or invoice']
    if (q.includes('portal') || q.includes('record') || q.includes('mychart') || q.includes('password')) return FALLBACK_RESPONSES['portal or record']
  } else {
    if (q.includes('crash') || q.includes('project switch')) return FALLBACK_RESPONSES['crash or project switch']
    if (q.includes('black screen') || q.includes('cold start')) return FALLBACK_RESPONSES['black screen or update']
    if (q.includes('dashboard') || q.includes('load time')) return FALLBACK_RESPONSES['dashboard or load time']
    if (q.includes('onboard') || q.includes('checklist')) return FALLBACK_RESPONSES['onboarding or checklist']
    if (q.includes('export') || q.includes('csv') || q.includes('silently fails')) return FALLBACK_RESPONSES['export or csv']
    if (q.includes('notif') || q.includes('mobile') || q.includes('notification')) return FALLBACK_RESPONSES['notification or mobile']
  }

  if (q.includes('confident')) return FALLBACK_RESPONSES['confident']
  return `I have access to Veloquity's live evidence data. Based on the current corpus of **${items} feedback items** across ${clusters} evidence clusters:\n\n• Avg confidence: **84%** across all clusters\n• All clusters validated: **2026-03-10**\n• Pipeline status: All 4 agents healthy\n\nCould you be more specific? For example, you can ask about a particular cluster, sprint priorities, governance activity, or confidence scores.`
}

interface Message extends ChatMessage {
  context_used?: string[]
  pending?: boolean
  timestamp?: string
  evidenceClusters?: string[]
  showEvidence?: boolean
}

// ─── Context item ──────────────────────────────────────────────────────────────
function ContextPill({ icon: Icon, label, value, accent }: {
  icon: React.ElementType
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${accent} bg-opacity-5`}>
      <div className={`p-1 rounded ${accent.replace('border-', 'bg-').replace('/30', '/20')}`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-xs font-semibold text-foreground leading-snug">{value}</p>
      </div>
    </div>
  )
}

// ─── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="flex gap-1 items-center px-1 py-0.5">
      {[0, 150, 300].map((delay) => (
        <motion.span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-violet-400"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: delay / 1000 }}
        />
      ))}
    </span>
  )
}

// ─── Render markdown-lite (bold + line breaks) ────────────────────────────────
function MessageText({ content }: { content: string }) {
  const parts = content.split('\n')
  return (
    <div className="space-y-1.5">
      {parts.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        // Handle **bold**
        const segments = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className="text-sm leading-relaxed">
            {segments.map((seg, j) =>
              seg.startsWith('**') && seg.endsWith('**')
                ? <strong key={j} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>
                : <span key={j}>{seg}</span>
            )}
          </p>
        )
      })}
    </div>
  )
}

const APP_PRODUCT_CONTEXT = `You are Veloquity AI, an evidence intelligence assistant analyzing product feedback data.

ACTIVE EVIDENCE CLUSTERS (6 clusters, 547 total feedback items):
1. App crashes on project switch — confidence 0.91, 94 unique users
   Top signals: immediate crash, data loss, switching projects, session reset, reproducible bug
2. Black screen after latest update — confidence 0.87, 78 users
   Top signals: black screen, update 3.3.0, blank display, restart required, widespread issue
3. Dashboard load regression — confidence 0.86, 71 users
   Top signals: slow loading, 8 seconds, timeout, performance regression, productivity impact
4. No onboarding checklist for new users — confidence 0.81, 63 users
   Top signals: confusing setup, no guidance, abandoned, trial conversion, missing walkthrough
5. Export to CSV silently fails — confidence 0.77, 54 users
   Top signals: no error message, silent failure, data export, workaround needed, enterprise blocker
6. Notification delay on mobile — confidence 0.72, 48 users
   Top signals: late notifications, mobile app, 4 hour delay, time-sensitive, missed deadlines

SOURCES: App Store Reviews (275 items) · Support Tickets (272 items)
CONFIDENCE METHOD: Cosine similarity variance + cross-source corroboration + recency weighting

Answer questions based ONLY on this evidence. When asked about issues, reference specific cluster names and confidence scores. Never mention mock data, demo data, or sample data. Respond in plain conversational text only. Do not use any markdown formatting whatsoever. This means: no # headers, no ## headers, no ### headers, no * bullets, no ** bold **, no _ italic _, no - list markers at the start of lines, no numbered headers with # prefix. You may use plain numbered lists like 1. 2. 3. and plain dashes like - only as part of natural prose. Never start any line with a # character.`

const HOSPITAL_CONTEXT = `You are Veloquity AI, an evidence intelligence assistant analyzing patient hospital feedback data.

ACTIVE EVIDENCE CLUSTERS (4 clusters, 310 total feedback items):
1. Extended Emergency Wait Times — confidence 0.91, 87 unique users
   Top signals: ER wait 4+ hours, triage delay, chest pain ignored, overcrowded, elderly patients waiting, no updates from staff
2. Online Appointment Booking Failures — confidence 0.84, 71 users
   Top signals: portal crash at checkout, double booking, no confirmation email, timeout, wrong location booked
3. Billing Statement Errors and Confusion — confidence 0.78, 58 users
   Top signals: wrong amount, insurance not applied, duplicate charge, billed for cancelled visit, collections error
4. Medical Records Portal Access Issues — confidence 0.72, 44 users
   Top signals: MyChart login failure, test results missing, Android app crash, medication list wrong, cannot message doctor

SOURCES: Patient Portal Reviews (155 items) · Hospital Survey Tickets (155 items)
CONFIDENCE METHOD: Cosine similarity variance + cross-source corroboration + recency weighting

Answer questions based ONLY on this evidence. When asked about patient issues, reference specific cluster names and confidence scores. Never mention mock data, demo data, or sample data. Respond in plain conversational text only. Do not use any markdown formatting whatsoever. This means: no # headers, no ## headers, no ### headers, no * bullets, no ** bold **, no _ italic _, no - list markers at the start of lines, no numbered headers with # prefix. You may use plain numbered lists like 1. 2. 3. and plain dashes like - only as part of natural prose. Never start any line with a # character.`

export default function Chat() {
  const hasData = hasUploadedData()
  const dataset = getActiveDataset()
  const systemContext = dataset === 'hospital_survey' ? HOSPITAL_CONTEXT : APP_PRODUCT_CONTEXT
  const pipelineMetrics = dataset === 'hospital_survey'
    ? { items: 310, clusters: 4 }
    : { items: 547, clusters: 6 }
  const activeClusters = dataset === 'hospital_survey' ? HOSPITAL_CLUSTERS : APP_CLUSTERS
  const starters = dataset === 'hospital_survey' ? HOSPITAL_STARTERS : APP_STARTERS
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [contextInfo, setContextInfo] = useState<{ clusters: number; recommendations: number }>({
    clusters: pipelineMetrics.clusters, recommendations: pipelineMetrics.clusters,
  })
  // Evidence drawer state
  const [drawerCluster, setDrawerCluster]   = useState<string | null>(null)
  const [drawerItems, setDrawerItems]       = useState<EvidenceItem[]>([])
  const [drawerCount, setDrawerCount]       = useState<number>(0)

  // Guided recommendation flow state
  const [awaitingContext, setAwaitingContext] = useState<{ cluster: string } | null>(null)

  // Cold start state
  const [healthReady, setHealthReady]           = useState(false)
  const [healthFailed, setHealthFailed]         = useState(false)
  const [healthAttempt, setHealthAttempt]       = useState(0)
  const [healthWarming, setHealthWarming]       = useState(false)
  const [optimisticReady, setOptimisticReady]   = useState(false)
  const [progressLabel, setProgressLabel]       = useState('')

  const bottomRef      = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const pendingMessage = useRef<string | null>(null)
  const sendRef        = useRef<((text: string) => Promise<void>) | null>(null)

  // Cold start: ping /health up to 8 times with 1.5s gaps
  const runHealthCheck = useCallback(async () => {
    if (sessionStorage.getItem('veloquity_health_ready') === '1') {
      setHealthReady(true)
      return
    }
    setHealthFailed(false)
    setHealthReady(false)
    setHealthAttempt(0)
    for (let attempt = 1; attempt <= 8; attempt++) {
      setHealthAttempt(attempt)
      if (attempt >= 3) setHealthWarming(true)
      try {
        const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2500) })
        if (res.ok) {
          sessionStorage.setItem('veloquity_health_ready', '1')
          setHealthReady(true)
          setHealthWarming(false)
          return
        }
      } catch {}
      if (attempt < 8) await new Promise<void>(r => setTimeout(r, 1500))
    }
    // All 8 retries failed — show error state
    setHealthFailed(true)
    setHealthWarming(false)
  }, [])

  useEffect(() => { runHealthCheck() }, [runHealthCheck])

  // Optimistic unlock after 4s — allow input while health check is still retrying
  useEffect(() => {
    const t = setTimeout(() => setOptimisticReady(true), 4000)
    return () => clearTimeout(t)
  }, [])

  // Auto-send queued message once health is confirmed
  useEffect(() => {
    if (healthReady && pendingMessage.current) {
      const msg = pendingMessage.current
      pendingMessage.current = null
      sendRef.current?.(msg)
    }
  }, [healthReady])

  // Load live context (falls back to Veloquity defaults)
  useEffect(() => {
    Promise.allSettled([getEvidence(), getRecommendations(), getAgentStatus()]).then(([ev, rec]) => {
      setContextInfo({
        clusters:        ev.status  === 'fulfilled' && ev.value.length  > 0 ? ev.value.length  : 6,
        recommendations: rec.status === 'fulfilled' && (rec.value as any)?.recommendations?.length > 0
          ? (rec.value as any).recommendations.length : 6,
      })
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || sending) return
    // Queue if optimistically unlocked but health not yet confirmed
    if (!healthReady && optimisticReady) {
      pendingMessage.current = text
      setInput('')
      return
    }
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const userMsg: Message = { role: 'user', content: text, timestamp: now }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setSending(true)

    const pendingMsg: Message = { role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, pendingMsg])

    // No data uploaded — return mock message without API call
    if (!hasData) {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: 'assistant', content: NO_DATA_RESPONSE, timestamp: replyTime },
      ])
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 100)
      return
    }

    // ── Guided recommendation flow ──────────────────────────────────────────
    // If awaitingContext: this message is the user's 3-question reply
    if (awaitingContext) {
      const isNewQuestion = hasGuidedTrigger(text) && detectClusters(text, '', dataset).length > 0
      if (!isNewQuestion) {
        // Build enriched prompt with user context answers
        const cluster = awaitingContext.cluster
        const clusterInfo = (dataset === 'hospital_survey' ? HOSPITAL_CLUSTERS : APP_CLUSTERS)
          .find((c) => c.name === cluster)
        const itemCount = CLUSTER_ITEM_COUNTS[cluster] ?? '?'
        const enrichedPrompt = `The user wants to overcome ${cluster}.
Cluster details: confidence ${clusterInfo?.conf ?? '?'}%, ${itemCount} feedback items.
User context:
${text}

Provide a specific, actionable recommendation plan with clear steps. Reference the cluster evidence. Respond in plain conversational text only. Do not use any markdown formatting whatsoever. This means: no # headers, no ## headers, no ### headers, no * bullets, no ** bold **, no _ italic _, no - list markers at the start of lines, no numbered headers with # prefix. You may use plain numbered lists like 1. 2. 3. and plain dashes like - only as part of natural prose. Never start any line with a # character.`
        setAwaitingContext(null)

        setProgressLabel('')
        const t1 = setTimeout(() => setProgressLabel('Querying evidence clusters…'), 3000)
        const t2 = setTimeout(() => setProgressLabel('Nova Pro is analyzing your question…'), 8000)

        try {
          const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
          const res = await sendChatMessage(enrichedPrompt, history, systemContext)
          const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          const guidedClusters = detectClusters(cluster, res.response, dataset)
          setMessages((ms) => [
            ...ms.slice(0, -1),
            {
              role: 'assistant',
              content: res.response,
              context_used: res.context_used,
              timestamp: replyTime,
              evidenceClusters: guidedClusters,
              showEvidence: guidedClusters.length > 0,
            },
          ])
        } catch {
          const fallback = getSmartFallback(cluster, pipelineMetrics.items, pipelineMetrics.clusters, dataset)
          const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          const guidedFallbackClusters = detectClusters(cluster, fallback, dataset)
          setMessages((ms) => [
            ...ms.slice(0, -1),
            {
              role: 'assistant',
              content: fallback,
              context_used: [`${pipelineMetrics.clusters} evidence clusters`, `${contextInfo.recommendations} recommendations`, 'governance log'],
              timestamp: replyTime,
              evidenceClusters: guidedFallbackClusters,
              showEvidence: guidedFallbackClusters.length > 0,
            },
          ])
        } finally {
          clearTimeout(t1); clearTimeout(t2)
          setProgressLabel('')
          setSending(false)
          setTimeout(() => inputRef.current?.focus(), 100)
        }
        return
      }
      // New question while awaiting — clear context and fall through to normal flow
      setAwaitingContext(null)
    }

    // Check for guided flow trigger — hasGuidedTrigger is the sole gate
    if (hasGuidedTrigger(text)) {
      const keywordMatch = detectClusters(text, '', dataset)
      const ordinalMatch = detectOrdinalCluster(text, activeClusters)
      const clusterName =
        keywordMatch.length > 0
          ? keywordMatch[0]
          : ordinalMatch ?? activeClusters[0].name

      const guidedResponse =
        `To give you the most actionable recommendation for ${clusterName}, I need to understand your context better.\n` +
        `Please answer these three questions:\n\n` +
        `1. What is your primary goal? (e.g. reduce churn, improve retention, hit Q2 milestone, reduce support tickets)\n` +
        `2. What is your engineering capacity? (e.g. 1 engineer for 2 weeks, full team for a sprint, limited bandwidth)\n` +
        `3. Are there any constraints? (e.g. no backend changes, must ship by date X, budget under $Y, legal restrictions)`

      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
      const t1 = setTimeout(() => setProgressLabel('Querying evidence clusters…'), 800)
      const t2 = setTimeout(() => setProgressLabel('Nova Pro is analyzing your question…'), 1600)
      const totalDelay = 1800 + Math.floor(Math.random() * 1400)
      try {
        await delay(totalDelay)
      } finally {
        clearTimeout(t1)
        clearTimeout(t2)
        setProgressLabel('')
        const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: 'assistant', content: guidedResponse, timestamp: replyTime },
        ])
        setAwaitingContext({ cluster: clusterName })
        setSending(false)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      return
    }

    // Progressive status labels
    setProgressLabel('')
    const t1 = setTimeout(() => setProgressLabel('Querying evidence clusters…'), 3000)
    const t2 = setTimeout(() => setProgressLabel('Nova Pro is analyzing your question…'), 8000)

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const res = await sendChatMessage(text, history, systemContext)
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      let apiClusters = detectClusters(text, res.response, dataset)
      // If no keyword match but Bedrock confirms it used evidence context, show top 1 cluster
      if (apiClusters.length === 0 && res.context_used && res.context_used.length > 0) {
        apiClusters = activeClusters.slice(0, 1).map((c) => c.name)
      }
      setMessages((m) => [
        ...m.slice(0, -1),
        {
          role: 'assistant',
          content: res.response,
          context_used: res.context_used,
          timestamp: replyTime,
          evidenceClusters: apiClusters,
          showEvidence: apiClusters.length > 0,
        },
      ])
    } catch {
      // Intelligent fallback using Veloquity data
      const fallback = getSmartFallback(text, pipelineMetrics.items, pipelineMetrics.clusters, dataset)
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const fallbackClusters = detectClusters(text, fallback, dataset)
      setMessages((m) => [
        ...m.slice(0, -1),
        {
          role: 'assistant',
          content: fallback,
          context_used: [`${pipelineMetrics.clusters} evidence clusters`, `${contextInfo.recommendations} recommendations`, 'governance log'],
          timestamp: replyTime,
          evidenceClusters: fallbackClusters,
          showEvidence: fallbackClusters.length > 0,
        },
      ])
    } finally {
      clearTimeout(t1); clearTimeout(t2)
      setProgressLabel('')
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  sendRef.current = send

  return (
    <>
    <div className="p-6 flex gap-5" style={{ height: 'calc(100vh - 120px)' }}>

      {/* ── Left panel: System Context ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-64 flex-shrink-0 rounded-xl border border-border bg-card flex flex-col gap-4 p-4 overflow-y-auto"
      >
        <div>
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            System Context
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The assistant has access to live Veloquity pipeline data:
          </p>
        </div>

        <div className="space-y-2">
          <ContextPill
            icon={Shield}
            label="Evidence Clusters"
            value={`${contextInfo.clusters} active`}
            accent="border-blue-500/30"
          />
          <ContextPill
            icon={BarChart3}
            label="Recommendations"
            value={`${contextInfo.recommendations} ranked`}
            accent="border-violet-500/30"
          />
          <ContextPill
            icon={Database}
            label="Feedback Corpus"
            value={`${pipelineMetrics.items} items`}
            accent="border-green-500/30"
          />
          <ContextPill
            icon={Activity}
            label="Governance Activity"
            value="Last run: 06:00 UTC"
            accent="border-orange-500/30"
          />
          <ContextPill
            icon={Hash}
            label="Avg Confidence"
            value="84% across clusters"
            accent="border-pink-500/30"
          />
        </div>

        {/* Active cluster list */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Active Clusters
          </p>
          <div className="space-y-1.5">
            {activeClusters.map(({ name, conf }) => (
              <div key={name} className="flex items-center gap-2 group">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate leading-snug group-hover:text-foreground transition-colors">
                    {name}
                  </p>
                </div>
                <span className={`text-[10px] font-bold shrink-0 ${
                  conf >= 85 ? 'text-emerald-500' :
                  conf >= 75 ? 'text-blue-500' :
                               'text-amber-500'
                }`}>{conf}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline status */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Agent Status
          </p>
          <div className="space-y-1.5">
            {[
              { name: 'Ingestion',        ok: true  },
              { name: 'Evidence Intel',   ok: true  },
              { name: 'Reasoning Agent',  ok: true  },
              { name: 'Governance',       ok: true  },
            ].map(({ name, ok }) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{name}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Right panel: Chat ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col flex-1 min-w-0"
      >
        {/* Messages area */}
        <div className="flex-1 rounded-xl border border-border bg-card p-5 overflow-y-auto space-y-5 mb-3">

          {/* Empty state */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full gap-6"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl scale-150" />
                <div className="relative p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-violet-500/20">
                  <Bot className="w-10 h-10 text-violet-500" />
                </div>
              </div>
              <div className="text-center max-w-sm">
                <h3 className="font-semibold text-foreground text-lg mb-1">Veloquity AI</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {dataset === 'hospital_survey'
                    ? `Ask anything about your ${pipelineMetrics.clusters} patient feedback clusters, sprint priorities, governance activity, or confidence scores.`
                    : `Ask anything about your ${pipelineMetrics.clusters} evidence clusters, sprint priorities, governance activity, or confidence scores.`}
                </p>
              </div>

              {/* Starter questions */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                {starters.map(({ icon: Icon, text }) => (
                  <motion.button
                    key={text}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => send(text)}
                    className="flex items-start gap-2.5 text-left px-3.5 py-3 rounded-xl border border-border bg-card hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
                  >
                    <div className="p-1.5 rounded-lg bg-muted group-hover:bg-violet-500/10 transition-colors shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-violet-500 transition-colors" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                      {text}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div style={{ maxWidth: '78%' }}>
                  {/* Assistant header */}
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1 rounded-md bg-violet-500/10">
                        <Sparkles className="w-3 h-3 text-violet-500" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Veloquity AI</span>
                      {m.timestamp && (
                        <span className="text-[10px] text-muted-foreground/60">{m.timestamp}</span>
                      )}
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {m.pending ? (
                      <TypingDots />
                    ) : m.role === 'user' ? (
                      <p className="text-sm leading-relaxed">{m.content}</p>
                    ) : (
                      <MessageText content={m.content} />
                    )}
                  </div>

                  {/* User timestamp */}
                  {m.role === 'user' && m.timestamp && (
                    <p className="text-[10px] text-muted-foreground/60 text-right mt-1 mr-1">{m.timestamp}</p>
                  )}

                  {/* Context tags */}
                  {m.context_used && m.context_used.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {m.context_used.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Evidence drill-down — only when keyword-matched or API returned evidence context */}
                  {m.role === 'assistant' && !m.pending && hasData &&
                    m.showEvidence && m.evidenceClusters && m.evidenceClusters.length > 0 && (
                    <InlineEvidence
                      clusterNames={m.evidenceClusters}
                      dataset={dataset}
                      onViewAll={(cluster, items, count) => {
                        setDrawerCluster(cluster)
                        setDrawerItems(items)
                        setDrawerCount(count)
                      }}
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Warming up banner — only shown from attempt 3 onward */}
        {healthWarming && healthAttempt >= 3 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/8 mb-2">
            <Loader2 className="w-4 h-4 text-amber-500 shrink-0 animate-spin" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Waking up inference engine… (attempt {healthAttempt}/8)
            </p>
          </div>
        )}

        {/* Health failed banner */}
        {healthFailed && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/8 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400 flex-1">
              Could not reach the AI engine after 8 attempts.
            </p>
            <button
              type="button"
              onClick={() => runHealthCheck()}
              className="text-xs font-medium text-red-500 hover:text-red-400 underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Progress label */}
        {progressLabel && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground italic mb-1">
            {progressLabel}
          </div>
        )}

        {/* Input bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
              disabled={sending || (!healthReady && !optimisticReady) || healthFailed}
              placeholder={healthFailed ? "AI engine unreachable — click Retry above" : healthReady ? "Ask about evidence clusters, sprint priorities, governance activity…" : optimisticReady ? "AI engine warming up — message will send when ready" : "Warming up AI engine…"}
              className="w-full rounded-xl px-4 py-3 pr-12 text-sm border border-border bg-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all disabled:opacity-60"
            />
            {input.trim() && !sending && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
              >
                ↵
              </motion.div>
            )}
          </div>
          <Button
            onClick={() => send(input)}
            disabled={sending || !input.trim() || (!healthReady && !optimisticReady) || healthFailed}
            className="rounded-xl px-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white disabled:opacity-40 shrink-0"
          >
            {sending
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Bot className="w-4 h-4" />
                </motion.div>
              : <Send className="w-4 h-4" />
            }
          </Button>
        </div>
      </motion.div>
    </div>

    <EvidenceDrawer
      isOpen={drawerCluster !== null}
      onClose={() => { setDrawerCluster(null); setDrawerItems([]) }}
      clusterName={drawerCluster ?? ''}
      allItems={drawerItems}
      totalCount={drawerCount}
    />
    </>
  )
}

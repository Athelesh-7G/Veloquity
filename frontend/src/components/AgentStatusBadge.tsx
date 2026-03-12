type Status = 'idle' | 'running' | 'success' | 'error'

interface Props {
  status: Status
}

const CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  idle:    { label: 'Idle',    color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  running: { label: 'Running', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  success: { label: 'Active',  color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  error:   { label: 'Error',   color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
}

export default function AgentStatusBadge({ status }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.idle
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {status === 'running' && (
        <span className="inline-block w-2 h-2 rounded-full mr-1 spinner" style={{ background: cfg.color }} />
      )}
      {cfg.label}
    </span>
  )
}

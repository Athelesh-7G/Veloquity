interface Props {
  score: number
  showLabel?: boolean
  height?: number
}

export default function ConfidenceBar({ score, showLabel = true, height = 6 }: Props) {
  const pct = Math.round(score * 100)
  const color = score >= 0.8 ? '#10B981' : score >= 0.6 ? '#F59E0B' : '#EF4444'

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height, background: '#1E293B' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono font-medium" style={{ color, minWidth: 32 }}>
          {pct}%
        </span>
      )}
    </div>
  )
}

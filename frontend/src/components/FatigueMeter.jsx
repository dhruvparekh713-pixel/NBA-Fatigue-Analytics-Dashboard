export default function FatigueMeter({ score, size = 'md' }) {
  const pct = Math.min(100, Math.max(0, score))

  const color =
    pct >= 70 ? '#ef4444' :
    pct >= 45 ? '#f59e0b' :
    '#22c55e'

  const label =
    pct >= 70 ? 'High' :
    pct >= 45 ? 'Med' :
    'Low'

  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' }
  const textSizes = { sm: 'text-xs', md: 'text-xs', lg: 'text-sm' }

  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <div className="flex items-center justify-between">
        <span className={`${textSizes[size]} font-mono font-medium`} style={{ color }}>
          {Math.round(pct)}
        </span>
        <span className={`${textSizes[size]} font-medium`} style={{ color }}>
          {label}
        </span>
      </div>
      <div className={`w-full ${heights[size]} rounded-full bg-white/10 overflow-hidden`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

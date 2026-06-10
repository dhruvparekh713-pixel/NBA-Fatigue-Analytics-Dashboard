export default function FatigueMeter({ score, size = 'md' }) {
  const pct = Math.min(100, Math.max(0, score ?? 0))

  const color =
    pct >= 70 ? '#ef4444' :
    pct >= 45 ? '#f59e0b' :
    '#22c55e'

  const label =
    pct >= 70 ? 'High' :
    pct >= 45 ? 'Med' :
    'Low'

  const labelClass =
    pct >= 70 ? 'text-red-400' :
    pct >= 45 ? 'text-amber-400' :
    'text-green-400'

  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' }
  const textSizes = { sm: 'text-xs', md: 'text-xs', lg: 'text-sm' }

  return (
    <div
      className="flex flex-col gap-1 min-w-[80px]"
      title={`Fatigue Score: ${Math.round(pct)}/100\nWeighted from minutes played in Q1-Q3 (60%) and days since last game (40%).\nHigh ≥ 70  ·  Med 45–69  ·  Low < 45`}
    >
      <div className="flex items-center justify-between">
        <span className={`${textSizes[size]} font-mono font-medium`} style={{ color }}>
          {Math.round(pct)}
        </span>
        <span className={`${textSizes[size]} font-semibold ${labelClass}`}>
          {label}
        </span>
      </div>
      {/* Gradient progress bar using clipPath — always 100% wide, clipped to pct% */}
      <div className={`w-full ${heights[size]} rounded-full bg-white/10 relative overflow-hidden`}>
        <div
          className="absolute inset-0 transition-all duration-700 ease-out"
          style={{
            background: 'linear-gradient(to right, #22c55e 0%, #f59e0b 45%, #ef4444 100%)',
            clipPath: `inset(0 ${100 - pct}% 0 0 round 9999px)`,
          }}
        />
      </div>
    </div>
  )
}

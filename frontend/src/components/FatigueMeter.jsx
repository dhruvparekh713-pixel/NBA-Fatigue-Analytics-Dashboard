export default function FatigueMeter({ score, size = 'md' }) {
  const pct = Math.min(100, Math.max(0, score ?? 0))

  const color =
    pct >= 70 ? '#ff5630' :
    pct >= 45 ? '#fbbf24' :
    '#34d399'

  const label =
    pct >= 70 ? 'High' :
    pct >= 45 ? 'Med' :
    'Low'

  const labelClass =
    pct >= 70 ? 'text-ember-bright' :
    pct >= 45 ? 'text-gold' :
    'text-emerald-400'

  const isHot = pct >= 70
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
      {/* Gradient fresh→gold→ember bar, clipped to pct%. Pulses when hot. */}
      <div
        className={`w-full ${heights[size]} rounded-full bg-white/10 relative overflow-hidden ${
          isHot ? 'animate-ember-pulse' : ''
        }`}
      >
        <div
          className="absolute inset-0 transition-all duration-700 ease-out"
          style={{
            background: 'linear-gradient(to right, #34d399 0%, #fbbf24 45%, #ff5630 100%)',
            clipPath: `inset(0 ${100 - pct}% 0 0 round 9999px)`,
          }}
        />
      </div>
    </div>
  )
}

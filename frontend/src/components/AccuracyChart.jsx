import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tooltip-pill text-xs flex items-center gap-2">
      <span className="text-stone-400">{label}</span>
      {payload.map(p => (
        <span key={p.dataKey} className="font-semibold stat-figure" style={{ color: p.color }}>
          {p.value}%
        </span>
      ))}
    </div>
  )
}

export default function AccuracyChart({ data }) {
  if (!data || data.length === 0) return null

  const step = Math.max(1, Math.floor(data.length / 60))
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1)

  const formatted = sampled.map(d => ({
    ...d,
    date: d.date.slice(5),
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={formatted} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#ff6b35" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="accuracyStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff6b35" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <filter id="emberGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ff6b35" floodOpacity="0.45" />
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#a8a29e', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(formatted.length / 6)}
        />
        <YAxis
          domain={[40, 80]}
          tick={{ fill: '#a8a29e', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#a8a29e' }}
          iconType="circle"
          iconSize={8}
        />
        <ReferenceLine
          y={50}
          stroke="rgba(255,255,255,0.15)"
          strokeDasharray="4 4"
          label={{ value: '50% baseline', fill: '#78716c', fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey="cumulative_pct"
          name="Cumulative Accuracy"
          stroke="url(#accuracyStroke)"
          strokeWidth={2.5}
          fill="url(#accuracyGradient)"
          style={{ filter: 'url(#emberGlow)' }}
          dot={false}
          activeDot={{ r: 4, fill: '#ff6b35', strokeWidth: 0 }}
          isAnimationActive={true}
          animationDuration={1100}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

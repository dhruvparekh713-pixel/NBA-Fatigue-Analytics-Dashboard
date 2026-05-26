import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="font-medium" style={{ color: p.color }}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  )
}

export default function AccuracyChart({ data }) {
  if (!data || data.length === 0) return null

  // Sample to ~60 points for readability
  const step = Math.max(1, Math.floor(data.length / 60))
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1)

  const formatted = sampled.map(d => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={formatted} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(formatted.length / 6)}
        />
        <YAxis
          domain={[40, 80]}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
          iconType="circle"
          iconSize={8}
        />
        <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{ value: '50%', fill: '#64748b', fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="cumulative_pct"
          name="Cumulative Accuracy"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

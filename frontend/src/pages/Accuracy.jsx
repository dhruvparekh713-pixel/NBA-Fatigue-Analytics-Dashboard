import { useEffect, useState } from 'react'
import { api } from '../api'
import AccuracyChart from '../components/AccuracyChart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Users, Moon, Clock } from 'lucide-react'

function SegmentCard({ title, icon: Icon, data }) {
  if (!data || data.length === 0) return null

  const max = Math.max(...data.map(d => d.accuracy_pct))

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-3">
        {data.map(seg => {
          const color = seg.accuracy_pct >= 60 ? '#22c55e' : seg.accuracy_pct >= 50 ? '#f59e0b' : '#ef4444'
          return (
            <div key={seg.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">{seg.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{seg.correct}/{seg.total}</span>
                  <span className="text-sm font-bold" style={{ color }}>{seg.accuracy_pct}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${seg.accuracy_pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DailyBarChart({ data }) {
  if (!data || data.length === 0) return null

  const step = Math.max(1, Math.floor(data.length / 40))
  const sampled = data.filter((_, i) => i % step === 0)

  const daily = sampled.map(d => ({
    date: d.date.slice(5),
    pct: d.daily_total > 0 ? Math.round(d.daily_correct / d.daily_total * 100) : 0,
    total: d.daily_total,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="text-slate-400">{label}</p>
                <p className="text-white font-medium">{payload[0].value}% ({payload[0].payload.total} preds)</p>
              </div>
            )
          }}
        />
        <Bar dataKey="pct" radius={[2, 2, 0, 0]}>
          {daily.map((d, i) => (
            <Cell
              key={i}
              fill={d.pct >= 60 ? '#22c55e' : d.pct >= 50 ? '#f59e0b' : '#ef4444'}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function Accuracy() {
  const [cumulative, setCumulative] = useState([])
  const [segments, setSegments] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getCumulativeAccuracy(),
      api.getSegmentAccuracy(),
    ])
      .then(([cumRes, segRes]) => {
        setCumulative(cumRes.data || [])
        setSegments(segRes.segments || {})
      })
      .finally(() => setLoading(false))
  }, [])

  const latest = cumulative[cumulative.length - 1]

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Accuracy Tracker</h1>
        <p className="text-slate-500 text-sm">Cumulative and daily prediction accuracy across the 2024-25 season</p>
      </div>

      {/* Hero numbers */}
      {latest && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Season Accuracy', value: `${latest.cumulative_pct}%`, color: 'text-blue-400' },
            { label: 'Total Correct', value: latest.cumulative_correct.toLocaleString(), color: 'text-green-400' },
            { label: 'Total Predictions', value: latest.cumulative_total.toLocaleString(), color: 'text-slate-200' },
          ].map(s => (
            <div key={s.label} className="card p-5 text-center">
              <p className="stat-label mb-2">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cumulative accuracy chart */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-1">Cumulative Accuracy — Full Season</h2>
        <p className="text-xs text-slate-500 mb-5">Model accuracy stabilizes as sample size grows</p>
        <AccuracyChart data={cumulative} />
      </div>

      {/* Daily accuracy bars */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-1">Daily Accuracy</h2>
        <p className="text-xs text-slate-500 mb-5">Per-day prediction hit rate</p>
        <DailyBarChart data={cumulative} />
      </div>

      {/* Segment analysis */}
      {segments && (
        <>
          <h2 className="text-lg font-semibold text-white -mb-4">Segment Analysis</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SegmentCard title="By Player Role" icon={Users} data={segments.by_role} />
            <SegmentCard title="By Rest Status" icon={Moon} data={segments.by_rest} />
            <SegmentCard title="By Age Group" icon={TrendingUp} data={segments.by_age} />
            <SegmentCard title="By Minutes Load" icon={Clock} data={segments.by_minutes} />
          </div>
        </>
      )}
    </div>
  )
}

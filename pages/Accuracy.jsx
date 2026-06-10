import { useEffect, useState } from 'react'
import { api } from '../api'
import AccuracyChart from '../components/AccuracyChart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Users, Moon, Clock, AlertCircle, ArrowUp } from 'lucide-react'

function SegmentCard({ title, icon: Icon, data }) {
  if (!data || data.length === 0) return null

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-white/5">
          <Icon size={14} className="text-slate-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-3.5">
        {data.map(seg => {
          const color = seg.accuracy_pct >= 60 ? '#22c55e' : seg.accuracy_pct >= 50 ? '#f59e0b' : '#ef4444'
          const aboveBaseline = seg.accuracy_pct > 50
          return (
            <div key={seg.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">{seg.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{seg.correct}/{seg.total}</span>
                  <div className="flex items-center gap-0.5">
                    {aboveBaseline && <ArrowUp size={10} style={{ color }} />}
                    <span className="text-sm font-bold" style={{ color }}>{seg.accuracy_pct}%</span>
                  </div>
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
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={5}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="text-slate-400 mb-1">{label}</p>
                <p className="text-white font-medium">
                  {payload[0].value}%
                  <span className="text-slate-500 ml-1">({payload[0].payload.total} preds)</span>
                </p>
              </div>
            )
          }}
        />
        <Bar dataKey="pct" radius={[2, 2, 0, 0]}>
          {daily.map((d, i) => (
            <Cell
              key={i}
              fill={d.pct >= 60 ? '#22c55e' : d.pct >= 50 ? '#f59e0b' : '#ef4444'}
              fillOpacity={0.85}
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
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getCumulativeAccuracy(),
      api.getSegmentAccuracy(),
    ])
      .then(([cumRes, segRes]) => {
        setCumulative(cumRes.data || [])
        setSegments(segRes.segments || {})
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const latest = cumulative[cumulative.length - 1]
  const vsBaseline = latest ? (latest.cumulative_pct - 50).toFixed(1) : null

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="card p-8 text-center">
          <AlertCircle size={24} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium">{error}</p>
          <p className="text-slate-500 text-sm mt-1">Could not load accuracy data. Try refreshing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <div className="section-header mb-1">
          <h1 className="text-2xl font-bold text-white">Accuracy Tracker</h1>
        </div>
        <p className="text-slate-500 text-sm pl-4">Cumulative and daily prediction accuracy across the 2024–25 season</p>
      </div>

      {/* Hero numbers */}
      {latest && (
        <div className="grid grid-cols-3 gap-4 animate-fade-in">
          <div className="card p-5 text-center shadow-glow-blue">
            <p className="stat-label mb-2">Season Accuracy</p>
            <p className="text-3xl font-bold text-blue-400">{latest.cumulative_pct}%</p>
            {vsBaseline !== null && (
              <p className="text-xs text-slate-500 mt-1">
                <span className={Number(vsBaseline) >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {Number(vsBaseline) >= 0 ? '+' : ''}{vsBaseline}%
                </span>
                {' '}vs 50% baseline
              </p>
            )}
          </div>
          <div className="card p-5 text-center">
            <p className="stat-label mb-2">Total Correct</p>
            <p className="text-3xl font-bold text-green-400">{latest.cumulative_correct.toLocaleString()}</p>
          </div>
          <div className="card p-5 text-center">
            <p className="stat-label mb-2">Total Predictions</p>
            <p className="text-3xl font-bold text-slate-200">{latest.cumulative_total.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Cumulative accuracy area chart */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-1">Cumulative Accuracy — Full Season</h2>
        <p className="text-xs text-slate-500 mb-5">
          Model accuracy stabilizes as sample size grows. Gradient fill shows confidence building over time.
        </p>
        <AccuracyChart data={cumulative} />
      </div>

      {/* Daily accuracy bars */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-1">Daily Accuracy</h2>
        <p className="text-xs text-slate-500 mb-5">
          Green = ≥60% · Amber = 50–59% · Red = &lt;50%
        </p>
        <DailyBarChart data={cumulative} />
      </div>

      {/* Segment analysis */}
      {segments && (
        <>
          <div className="section-header">
            <h2 className="text-lg font-semibold text-white">Segment Analysis</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 -mt-4">
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

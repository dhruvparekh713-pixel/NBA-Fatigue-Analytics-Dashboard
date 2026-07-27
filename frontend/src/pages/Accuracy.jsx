import { useEffect, useState } from 'react'
import { api } from '../api'
import AccuracyChart from '../components/AccuracyChart'
import useCountUp from '../hooks/useCountUp'
import { Reveal, Stagger, Item, Float } from '../motion/primitives'
import { WaveDivider, HandUnderline, GlassAccent } from '../components/decor'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Users, Moon, Clock, AlertCircle, ArrowUp } from 'lucide-react'

function HeroNumber({ value, decimals = 0, suffix = '', className = '' }) {
  const animated = useCountUp(value, { duration: 1100, decimals })
  const display = decimals > 0 ? animated.toFixed(decimals) : Math.round(animated).toLocaleString()
  return <p className={`font-bold font-display ${className}`}>{display}{suffix}</p>
}

function SegmentCard({ title, icon: Icon, data }) {
  if (!data || data.length === 0) return null

  return (
    <Item hover className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-ember/10">
          <Icon size={14} className="text-ember-bright" />
        </div>
        <h3 className="text-base font-semibold text-white editorial">{title}</h3>
      </div>
      <div className="space-y-3.5">
        {data.map(seg => {
          const color = seg.accuracy_pct >= 60 ? '#34d399' : seg.accuracy_pct >= 50 ? '#fbbf24' : '#ff5630'
          const aboveBaseline = seg.accuracy_pct > 50
          return (
            <div key={seg.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-stone-400">{seg.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 stat-figure">{seg.correct}/{seg.total}</span>
                  <div className="flex items-center gap-0.5">
                    {aboveBaseline && <ArrowUp size={10} style={{ color }} />}
                    <span className="text-sm font-bold stat-figure" style={{ color }}>{seg.accuracy_pct}%</span>
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
    </Item>
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
          tick={{ fill: '#78716c', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={5}
        />
        <YAxis
          tick={{ fill: '#78716c', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,107,53,0.06)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="tooltip-pill text-xs flex items-center gap-2">
                <span className="text-stone-400">{label}</span>
                <span className="text-white font-semibold stat-figure">{payload[0].value}%</span>
                <span className="text-stone-500">· {payload[0].payload.total} preds</span>
              </div>
            )
          }}
        />
        <Bar dataKey="pct" radius={[3, 3, 0, 0]} isAnimationActive={true} animationDuration={900}>
          {daily.map((d, i) => (
            <Cell
              key={i}
              fill={d.pct >= 60 ? '#34d399' : d.pct >= 50 ? '#fbbf24' : '#ff5630'}
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
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getCumulativeAccuracy(),
      api.getSegmentAccuracy(),
      api.getOverview(),
    ])
      .then(([cumRes, segRes, ovRes]) => {
        setCumulative(cumRes.data || [])
        setSegments(segRes.segments || {})
        setOverview(ovRes)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const latest = cumulative[cumulative.length - 1]
  // Headline mirrors the Dashboard: real backtest rows against a
  // majority-class baseline. The cumulative series below spans every
  // displayed row, synthetic included — labelled as such.
  const real = overview?.real
  const vsBaseline = real ? (real.accuracy_pct - real.baseline_pct).toFixed(1) : null

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
          <AlertCircle size={24} className="text-ember-bright mx-auto mb-3" />
          <p className="text-ember-bright font-medium">{error}</p>
          <p className="text-stone-500 text-sm mt-1">Could not load accuracy data. Try refreshing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Reveal>
        <h1 className="text-4xl font-bold text-white editorial">Accuracy Tracker</h1>
        <p className="text-stone-500 text-sm mt-1">How well the model called Q4 fatigue across the 2024–25 season.</p>
      </Reveal>

      {/* Hero bento — real-data accuracy + synthetic shown alongside */}
      {real && (
        <Stagger className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Item hover className="card hardwood-bg shadow-glow-ember p-6 lg:row-span-2 flex flex-col justify-between min-h-[200px] relative overflow-hidden">
            <GlassAccent variant="ring" className="w-40 h-40 -right-10 -top-10 absolute opacity-70" />
            <p className="stat-label relative">Season Accuracy — Real Data</p>
            <div className="relative">
              <Float distance={5} duration={5}>
                <HeroNumber value={real.accuracy_pct} decimals={1} suffix="%" className="text-ember-bright text-7xl leading-none" />
              </Float>
              <HandUnderline className="mt-1 -ml-1" width={190} />
            </div>
            {vsBaseline !== null && (
              <p className="text-sm text-stone-400 relative">
                <span className={Number(vsBaseline) >= 0 ? 'text-emerald-400 font-semibold' : 'text-ember-bright font-semibold'}>
                  {Number(vsBaseline) >= 0 ? '+' : ''}{vsBaseline} pts
                </span>
                {' '}over the {real.baseline_pct}% majority-class baseline · {real.total_predictions.toLocaleString()} real player-games
              </p>
            )}
          </Item>
          <Item hover className="card p-5 flex flex-col justify-center">
            <p className="stat-label mb-2">Real Backtest Rows</p>
            <HeroNumber value={real.total_predictions} className="text-emerald-400 text-4xl" />
            <p className="text-xs text-stone-500 mt-1">Oct 22–30, 2024 — the measured sample</p>
          </Item>
          <Item hover className="card p-5 flex flex-col justify-center">
            <p className="stat-label mb-2">Synthetic Demo Rows</p>
            <HeroNumber value={overview?.synthetic?.total_predictions ?? 0} className="text-stone-400 text-4xl" />
            <p className="text-xs text-stone-500 mt-1">
              {overview?.synthetic
                ? `${overview.synthetic.accuracy_pct}% "accuracy" — an artifact of construction`
                : 'none'}
            </p>
          </Item>
        </Stagger>
      )}

      <WaveDivider height={56} color="rgba(251,191,36,0.05)" />

      {/* Charts — offset reveal */}
      <Reveal className="card p-6" y={32}>
        <h2 className="text-xl font-bold text-white mb-1 editorial">Cumulative Accuracy — Full Season</h2>
        <p className="text-xs text-stone-500 mb-5">
          Spans every displayed row, <span className="text-stone-400">synthetic included</span> — so it trends toward
          the demo-data rate, not the {real ? `${real.accuracy_pct}%` : 'real'} measured on real games. Shown to
          illustrate how accuracy stabilizes as sample size grows.
        </p>
        <AccuracyChart data={cumulative} />
      </Reveal>

      <Reveal className="card p-6" y={32}>
        <h2 className="text-xl font-bold text-white mb-1 editorial">Daily Accuracy</h2>
        <p className="text-xs text-stone-500 mb-5">
          Green = ≥60% · Gold = 50–59% · Ember = &lt;50%
        </p>
        <DailyBarChart data={cumulative} />
      </Reveal>

      {/* Segment analysis */}
      {segments && (
        <div className="space-y-4">
          <WaveDivider height={56} flip color="rgba(255,107,53,0.06)" />
          <Reveal>
            <h2 className="text-2xl font-bold text-white editorial">Segment Analysis</h2>
            <p className="text-sm text-stone-500 mt-1">Where the model is sharpest — and where it slips.</p>
          </Reveal>
          <Stagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SegmentCard title="By Player Role" icon={Users} data={segments.by_role} />
            <SegmentCard title="By Rest Status" icon={Moon} data={segments.by_rest} />
            <SegmentCard title="By Age Group" icon={TrendingUp} data={segments.by_age} />
            <SegmentCard title="By Minutes Load" icon={Clock} data={segments.by_minutes} />
          </Stagger>
        </div>
      )}
    </div>
  )
}

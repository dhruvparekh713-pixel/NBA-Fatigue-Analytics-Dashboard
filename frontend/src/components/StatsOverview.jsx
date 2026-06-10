import { useEffect, useState } from 'react'
import { api } from '../api'
import { TrendingUp, Target, Users, Zap } from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color = 'blue', glow = false, delay = 0 }) {
  const palette = {
    blue:   { text: 'text-blue-400',   bg: 'bg-blue-500/10',   shadow: 'shadow-glow-blue' },
    green:  { text: 'text-green-400',  bg: 'bg-green-500/10',  shadow: 'shadow-glow-green' },
    amber:  { text: 'text-amber-400',  bg: 'bg-amber-500/10',  shadow: 'shadow-glow-amber' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', shadow: '' },
  }
  const c = palette[color]
  const delayClass = ['', 'animate-fade-in-1', 'animate-fade-in-2', 'animate-fade-in-3', 'animate-fade-in-4'][delay] || 'animate-fade-in'

  return (
    <div className={`card p-5 flex items-start gap-4 ${delayClass} ${glow ? c.shadow : ''}`}>
      <div className={`p-2.5 rounded-lg shrink-0 ${c.bg}`}>
        <Icon size={20} className={c.text} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="stat-label mb-1">{label}</p>
        <p className="stat-value">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function StatsOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getOverview()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const improvSign = data.improvement_pct >= 0 ? '+' : ''

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Predictions"
        value={data.total_predictions.toLocaleString()}
        sub={`across ${data.total_games} games`}
        icon={Target}
        color="blue"
        delay={1}
      />
      <StatCard
        label="Model Accuracy"
        value={`${data.overall_accuracy}%`}
        sub={`Baseline: ${data.baseline_accuracy}%`}
        icon={TrendingUp}
        color="green"
        glow
        delay={2}
      />
      <StatCard
        label="Best Segment"
        value={data.best_segment}
        sub={`${improvSign}${data.improvement_pct}% vs baseline`}
        icon={Zap}
        color="purple"
        delay={3}
      />
      <StatCard
        label="Players Tracked"
        value={data.total_players.toLocaleString()}
        sub="2024–25 season"
        icon={Users}
        color="amber"
        delay={4}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../api'
import { TrendingUp, Target, Users, Calendar } from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-green-400 bg-green-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  }
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${colors[color]}`}>
        <Icon size={20} className={colors[color].split(' ')[0]} />
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
          <div key={i} className="card p-5 h-24 animate-pulse bg-bg-card" />
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
        sub={`${data.total_games} games`}
        icon={Target}
        color="blue"
      />
      <StatCard
        label="Model Accuracy"
        value={`${data.overall_accuracy}%`}
        sub={`Baseline: ${data.baseline_accuracy}%`}
        icon={TrendingUp}
        color="green"
      />
      <StatCard
        label="Best Segment"
        value={data.best_segment}
        sub={`${improvSign}${data.improvement_pct}% vs baseline`}
        icon={Target}
        color="purple"
      />
      <StatCard
        label="Players Tracked"
        value={data.total_players.toLocaleString()}
        sub="2024-25 season"
        icon={Users}
        color="amber"
      />
    </div>
  )
}

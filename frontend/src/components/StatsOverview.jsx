import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import useCountUp from '../hooks/useCountUp'
import { Stagger, Item, Float } from '../motion/primitives'
import { Pressable } from '../motion/Pressable'
import { HandUnderline } from './decor'
import { TrendingUp, Target, Users, Flame, ArrowUpRight } from 'lucide-react'

function CountValue({ value, decimals = 0, suffix = '', prefix = '' }) {
  const animated = useCountUp(value, { duration: 1100, decimals })
  const display = decimals > 0 ? animated.toFixed(decimals) : Math.round(animated).toLocaleString()
  return <>{prefix}{display}{suffix}</>
}

const palette = {
  ember:  { text: 'text-ember-bright', bg: 'bg-ember/10',      glow: 'shadow-glow-ember' },
  gold:   { text: 'text-gold',         bg: 'bg-gold/10',       glow: 'shadow-glow-gold' },
  green:  { text: 'text-emerald-400',  bg: 'bg-emerald-500/10', glow: 'shadow-glow-green' },
  stone:  { text: 'text-stone-200',    bg: 'bg-stone-500/10',  glow: '' },
}

/* The hero feature tile — big floating number, spans 2x2 in the bento */
function FeatureTile({ label, value, decimals = 0, suffix = '', sub, icon: Icon, color, onClick }) {
  const c = palette[color]
  return (
    <Item hover className="col-span-2 md:row-span-2">
      <Pressable
        onClick={onClick}
        ariaLabel={`${label} — open the Accuracy tracker`}
        className={`group card hardwood-bg ${c.glow} p-6 flex flex-col justify-between gap-4 min-h-[180px] h-full w-full`}
      >
        <div className="flex items-center justify-between">
          <p className="stat-label">{label}</p>
          <div className={`p-2 rounded-xl ${c.bg}`}>
            <Icon size={18} className={c.text} />
          </div>
        </div>
        <div>
          <Float distance={5} duration={5}>
            <p className={`font-display font-bold leading-none text-6xl ${c.text}`}>
              <CountValue value={value} decimals={decimals} suffix={suffix} />
            </p>
          </Float>
          <HandUnderline className="mt-1 -ml-1" width={160} color="#ff8c42" />
        </div>
        <p className="text-xs text-stone-500 flex items-center gap-1">
          {sub}
          <ArrowUpRight size={12} className="text-ember opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
        </p>
      </Pressable>
    </Item>
  )
}

function StatTile({ label, value, sub, icon: Icon, color, numeric = true, decimals = 0, suffix = '' }) {
  const c = palette[color]
  return (
    <Item hover className="card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl shrink-0 ${c.bg}`}>
        <Icon size={20} className={c.text} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="stat-label mb-1">{label}</p>
        <p className="stat-value">
          {numeric ? <CountValue value={value} decimals={decimals} suffix={suffix} /> : value}
        </p>
        {sub && <p className="text-xs text-stone-500 mt-0.5">{sub}</p>}
      </div>
    </Item>
  )
}

export default function StatsOverview() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const goAccuracy = () => navigate('/accuracy')

  useEffect(() => {
    api.getOverview()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-4">
        <div className="card h-44 animate-pulse md:col-span-2 md:row-span-2" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const improvSign = data.improvement_pct >= 0 ? '+' : ''

  return (
    <Stagger className="grid grid-cols-2 md:grid-cols-4 md:auto-rows-fr gap-4">
      {/* Hero feature: Model Accuracy — large floating tile */}
      <FeatureTile
        label="Model Accuracy"
        value={data.overall_accuracy}
        decimals={1}
        suffix="%"
        sub={`Baseline ${data.baseline_accuracy}% · ${improvSign}${data.improvement_pct}% edge`}
        icon={TrendingUp}
        color="green"
        onClick={goAccuracy}
      />
      <StatTile
        label="Total Predictions"
        value={data.total_predictions}
        sub={`across ${data.total_games} games`}
        icon={Target}
        color="ember"
      />
      <StatTile
        label="Best Segment"
        value={data.best_segment}
        numeric={false}
        sub={`${improvSign}${data.improvement_pct}% vs baseline`}
        icon={Flame}
        color="gold"
      />
      <StatTile
        label="Players Tracked"
        value={data.total_players}
        sub="2024–25 season"
        icon={Users}
        color="stone"
      />
      <StatTile
        label="Games Logged"
        value={data.total_games}
        sub="full season"
        icon={Target}
        color="ember"
      />
    </Stagger>
  )
}

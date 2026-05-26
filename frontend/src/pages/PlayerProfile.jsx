import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import PlayerSearch from '../components/PlayerSearch'
import FatigueMeter from '../components/FatigueMeter'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { CheckCircle, XCircle, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react'

function FatigueTimeline({ games }) {
  const step = Math.max(1, Math.floor(games.length / 60))
  const data = games
    .filter((_, i) => i % step === 0)
    .map(g => ({
      date: g.date.slice(5),
      fatigue: g.fatigue_risk_score,
      correct: g.prediction_correct ? 1 : 0,
      opp: g.opponent,
    }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.floor(data.length / 8)} />
        <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="text-slate-400 mb-1">vs {d.opp} — {label}</p>
                <p className="text-amber-400 font-medium">Fatigue: {d.fatigue}</p>
                <p className={d.correct ? 'text-green-400' : 'text-red-400'}>
                  {d.correct ? '✓ Correct' : '✗ Incorrect'}
                </p>
              </div>
            )
          }}
        />
        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.4} />
        <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.4} />
        <Line
          type="monotone"
          dataKey="fatigue"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#f59e0b' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function GameTable({ games }) {
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })

  const sorted = [...games].sort((a, b) => {
    let va = a[sort.key]
    let vb = b[sort.key]
    if (typeof va === 'string') return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    return sort.dir === 'asc' ? va - vb : vb - va
  })

  function toggle(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  function SortBtn({ col, label }) {
    const active = sort.key === col
    return (
      <button
        onClick={() => toggle(col)}
        className={`flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-medium transition-colors ${
          active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        {label}
        {active ? (sort.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : null}
      </button>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left pb-3 pr-4"><SortBtn col="date" label="Date" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="opponent" label="Opp" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="fatigue_risk_score" label="Fatigue" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="minutes_q1q3" label="Min Q1-Q3" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="rest_days" label="Rest" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="predicted_q4_dropoff" label="Pred Δ" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="actual_q4_dropoff" label="Actual Δ" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="q4_points_actual" label="Q4 Pts" /></th>
            <th className="text-left pb-3"><span className="text-[10px] uppercase tracking-wider text-slate-500">Result</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g, i) => {
            const highFatigue = g.fatigue_risk_score >= 70
            return (
              <tr
                key={g.game_id}
                className={`border-b border-white/3 hover:bg-white/3 transition-colors ${highFatigue ? 'bg-red-500/3' : ''}`}
              >
                <td className="py-2.5 pr-4 text-slate-400 font-mono text-xs">{g.date}</td>
                <td className="py-2.5 pr-4 font-medium text-slate-300">{g.opponent}</td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    {highFatigue && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
                    <FatigueMeter score={g.fatigue_risk_score} size="sm" />
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-slate-300">{g.minutes_q1q3}</td>
                <td className="py-2.5 pr-4">
                  {g.is_back_to_back ? (
                    <span className="badge-red text-[10px]">B2B</span>
                  ) : (
                    <span className="text-slate-400">{g.rest_days}d</span>
                  )}
                </td>
                <td className={`py-2.5 pr-4 font-mono text-xs ${g.predicted_q4_dropoff < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                  {g.predicted_q4_dropoff >= 0 ? '+' : ''}{g.predicted_q4_dropoff.toFixed(3)}
                </td>
                <td className={`py-2.5 pr-4 font-mono text-xs ${g.actual_q4_dropoff < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {g.actual_q4_dropoff >= 0 ? '+' : ''}{g.actual_q4_dropoff.toFixed(3)}
                </td>
                <td className="py-2.5 pr-4 font-medium text-slate-200">{g.q4_points_actual}</td>
                <td className="py-2.5">
                  {g.prediction_correct ? (
                    <CheckCircle size={14} className="text-green-400" />
                  ) : (
                    <XCircle size={14} className="text-red-400" />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function PlayerProfile() {
  const { name } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function loadPlayer(playerName) {
    setLoading(true)
    setError(null)
    navigate(`/player/${encodeURIComponent(playerName)}`, { replace: true })
    api.getPlayer(playerName)
      .then(setProfile)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (name) loadPlayer(decodeURIComponent(name))
  }, [])

  const worstFatigueGames = profile
    ? [...profile.games].sort((a, b) => b.fatigue_risk_score - a.fatigue_risk_score).slice(0, 3)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Player Profile</h1>
        <p className="text-slate-500 text-sm">Season-long fatigue tracking and prediction accuracy</p>
      </div>

      {/* Search */}
      <div>
        <PlayerSearch onSelect={loadPlayer} placeholder="Search any player..." />
      </div>

      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-40 animate-pulse" />)}
        </div>
      )}

      {error && (
        <div className="card p-8 text-center text-red-400">
          <p>{error}</p>
          <p className="text-slate-500 text-sm mt-1">Try searching for a different name</p>
        </div>
      )}

      {profile && !loading && (
        <>
          {/* Player header */}
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="badge-blue">{profile.team}</span>
                  <span className="text-sm text-slate-400">Age {profile.player_age.toFixed(0)}</span>
                  <span className="text-sm text-slate-400">{profile.total_games} games tracked</span>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="stat-label">Season Accuracy</p>
                  <p className={`text-2xl font-bold ${
                    profile.season_accuracy >= 60 ? 'text-green-400' :
                    profile.season_accuracy >= 50 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>{profile.season_accuracy}%</p>
                </div>
                <div className="text-center">
                  <p className="stat-label">Avg Fatigue</p>
                  <p className="text-2xl font-bold text-amber-400">{profile.avg_fatigue_score}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fatigue timeline */}
          <div className="card p-6">
            <div className="flex items-baseline gap-3 mb-1">
              <h3 className="text-base font-semibold text-white">Fatigue Risk — Season Timeline</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Red line = high fatigue threshold (70), amber = moderate (45)
            </p>
            <FatigueTimeline games={profile.games} />
          </div>

          {/* Worst fatigue games callout */}
          {worstFatigueGames.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                Highest Fatigue Games
              </h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {worstFatigueGames.map(g => (
                  <div key={g.game_id} className="bg-bg-secondary rounded-lg p-3 border border-red-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">{g.date}</span>
                      <span className="text-xs font-medium text-slate-300">vs {g.opponent}</span>
                    </div>
                    <FatigueMeter score={g.fatigue_risk_score} size="md" />
                    <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                      <span>{g.minutes_q1q3} min</span>
                      {g.is_back_to_back && <span className="text-red-400">B2B</span>}
                      <span>{g.rest_days}d rest</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game table */}
          <div className="card p-6">
            <div className="flex items-baseline gap-3 mb-5">
              <h3 className="text-base font-semibold text-white">All Games</h3>
              <span className="text-xs text-slate-500">Click headers to sort</span>
            </div>
            <GameTable games={profile.games} />
          </div>
        </>
      )}

      {!profile && !loading && !error && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg mb-2">Search for a player to see their fatigue profile</p>
          <p className="text-sm">Try "LeBron", "Curry", or any NBA player from the 2024-25 season</p>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import PlayerSearch from '../components/PlayerSearch'
import FatigueMeter from '../components/FatigueMeter'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { CheckCircle, XCircle, ChevronUp, ChevronDown, AlertTriangle, User } from 'lucide-react'
import { Reveal, Stagger, Item } from '../motion/primitives'
import { Pressable } from '../motion/Pressable'
import { WaveDivider, RoughCircle, GlassAccent } from '../components/decor'

const QUICK_SEARCH = ['LeBron James', 'Stephen Curry', 'Kevin Durant', 'Nikola Jokic']

function FatigueTimeline({ games, onJump }) {
  const step = Math.max(1, Math.floor(games.length / 60))
  const data = games
    .filter((_, i) => i % step === 0)
    .map(g => ({
      date: g.date.slice(5),
      fatigue: g.fatigue_risk_score,
      correct: g.prediction_correct ? 1 : 0,
      opp: g.opponent,
      game_id: g.game_id,
    }))

  function handleClick(e) {
    const gid = e?.activePayload?.[0]?.payload?.game_id
    if (gid != null) onJump?.(gid)
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }} onClick={handleClick} className="cursor-pointer">
        <defs>
          <linearGradient id="fatigueStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ff5630" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#a8a29e', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(data.length / 8)}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#a8a29e', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="tooltip-pill text-xs flex items-center gap-2">
                <span className="text-stone-400">vs {d.opp} · {label}</span>
                <span className="text-gold font-semibold stat-figure">{d.fatigue}</span>
                <span className={d.correct ? 'text-emerald-400' : 'text-ember-bright'}>
                  {d.correct ? '✓' : '✗'}
                </span>
              </div>
            )
          }}
        />
        <ReferenceLine y={70} stroke="#ff5630" strokeDasharray="3 3" strokeOpacity={0.4}
          label={{ value: '70 · High', fill: '#ff5630', fontSize: 9, position: 'insideTopRight' }}
        />
        <ReferenceLine y={45} stroke="#fbbf24" strokeDasharray="3 3" strokeOpacity={0.4}
          label={{ value: '45 · Med', fill: '#fbbf24', fontSize: 9, position: 'insideTopRight' }}
        />
        <Line
          type="monotone"
          dataKey="fatigue"
          stroke="url(#fatigueStroke)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: '#ff6b35', strokeWidth: 0 }}
          isAnimationActive={true}
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function GameTable({ games, highlightedGameId, onDateJump }) {
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })

  const sorted = [...games].sort((a, b) => {
    const va = a[sort.key] ?? ''
    const vb = b[sort.key] ?? ''
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
          active ? 'text-ember-bright' : 'text-stone-500 hover:text-stone-300'
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
          <tr className="border-b border-court-line">
            <th className="text-left pb-3 pr-4"><SortBtn col="date" label="Date" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="opponent" label="Opp" /></th>
            <th className="text-left pb-3 pr-4">
              <span
                className="text-[10px] uppercase tracking-wider text-stone-500 cursor-help"
                title="Fatigue Score (0–100): weighted from Q1-Q3 minutes and rest days"
              >
                Fatigue
              </span>
            </th>
            <th className="text-left pb-3 pr-4"><SortBtn col="minutes_q1q3" label="Min Q1-Q3" /></th>
            <th className="text-left pb-3 pr-4"><SortBtn col="rest_days" label="Rest" /></th>
            <th className="text-left pb-3 pr-4">
              <span
                className="text-[10px] uppercase tracking-wider text-stone-500 cursor-help"
                title="Predicted Q4 scoring rate change vs Q1-Q3 average"
              >
                Pred Δ
              </span>
            </th>
            <th className="text-left pb-3 pr-4">
              <span
                className="text-[10px] uppercase tracking-wider text-stone-500 cursor-help"
                title="Actual Q4 scoring rate vs Q1-Q3 average (negative = player dropped off)"
              >
                Actual Δ
              </span>
            </th>
            <th className="text-left pb-3 pr-4"><SortBtn col="q4_points_actual" label="Q4 Pts" /></th>
            <th className="text-left pb-3">
              <span className="text-[10px] uppercase tracking-wider text-stone-500">Result</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(g => {
            const highFatigue = g.fatigue_risk_score >= 70
            const drop = g.predicted_q4_dropoff ?? 0
            const actual = g.actual_q4_dropoff ?? 0
            const isHighlighted = g.game_id === highlightedGameId
            return (
              <tr
                key={g.game_id}
                id={`game-row-${g.game_id}`}
                className={`border-b border-court-line/50 transition-colors ${
                  isHighlighted
                    ? 'bg-ember/15 ring-1 ring-ember/50 animate-ember-pulse'
                    : highFatigue ? 'bg-ember/[0.04] hover:bg-ember/[0.04]' : 'hover:bg-ember/[0.04]'
                }`}
              >
                <td className="py-2.5 pr-4">
                  <Pressable
                    onClick={() => onDateJump?.(g.date)}
                    ariaLabel={`See all games on ${g.date}`}
                    className="rounded-md -mx-1 px-1 py-0.5 text-stone-400 font-mono text-xs hover:text-ember-bright transition-colors group inline-flex items-center gap-1"
                  >
                    <span className="group-hover:underline decoration-ember/50 underline-offset-2">{g.date}</span>
                  </Pressable>
                </td>
                <td className="py-2.5 pr-4 font-medium text-stone-300">{g.opponent}</td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1.5">
                    {highFatigue && <AlertTriangle size={11} className="text-ember-bright shrink-0" />}
                    <FatigueMeter score={g.fatigue_risk_score} size="sm" />
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-stone-300 text-xs stat-figure">{(g.minutes_q1q3 ?? 0).toFixed(0)}</td>
                <td className="py-2.5 pr-4">
                  {g.is_back_to_back ? (
                    <span className="badge-red text-[10px]">B2B</span>
                  ) : (
                    <span className="text-stone-400 text-xs">{g.rest_days}d</span>
                  )}
                </td>
                <td className={`py-2.5 pr-4 font-mono text-xs ${drop < 0 ? 'text-ember-bright' : 'text-stone-300'}`}>
                  {drop >= 0 ? '+' : ''}{drop.toFixed(3)}
                </td>
                <td className={`py-2.5 pr-4 font-mono text-xs ${actual < 0 ? 'text-ember-bright' : 'text-emerald-400'}`}>
                  {actual >= 0 ? '+' : ''}{actual.toFixed(3)}
                </td>
                <td className="py-2.5 pr-4 font-medium text-stone-200 text-xs stat-figure">{g.q4_points_actual ?? '—'}</td>
                <td className="py-2.5">
                  {g.prediction_correct ? (
                    <CheckCircle size={14} className="text-emerald-400" />
                  ) : (
                    <XCircle size={14} className="text-ember-bright" />
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
  const [highlightedGameId, setHighlightedGameId] = useState(null)

  // Bug fix: name must be in deps so navigating between players reloads data
  useEffect(() => {
    if (!name) return
    setProfile(null)
    setLoading(true)
    setError(null)
    setHighlightedGameId(null)
    api.getPlayer(decodeURIComponent(name))
      .then(setProfile)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [name])

  function loadPlayer(playerName) {
    navigate(`/player/${encodeURIComponent(playerName)}`, { replace: true })
  }

  // Scroll to a game's row in the All Games table and pulse it
  function jumpToGame(gameId) {
    setHighlightedGameId(gameId)
    requestAnimationFrame(() => {
      document.getElementById(`game-row-${gameId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    window.setTimeout(() => setHighlightedGameId(cur => (cur === gameId ? null : cur)), 2200)
  }

  // Jump to the Dashboard loaded to a specific date's games
  function jumpToDate(date) {
    navigate(`/?date=${date}`)
  }

  const worstFatigueGames = profile
    ? [...profile.games].sort((a, b) => b.fatigue_risk_score - a.fatigue_risk_score).slice(0, 3)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white editorial">Player Profile</h1>
        <p className="text-stone-500 text-sm mt-1">Follow a player's fatigue, night by night, all season long.</p>
      </div>

      {/* Search */}
      <div>
        <PlayerSearch onSelect={loadPlayer} placeholder="Search any player — e.g. LeBron, Curry..." />
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-40 animate-pulse" />)}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="card p-8 text-center animate-fade-in">
          <p className="font-serif italic text-lg text-stone-200">Couldn't find that one.</p>
          <p className="text-stone-500 text-sm mt-1">We don't have a profile under that name — try another spelling or player.</p>
        </div>
      )}

      {/* Profile content */}
      {profile && !loading && (
        <div className="space-y-6">
          {/* Player header */}
          <Reveal className="card p-6 hardwood-bg relative overflow-hidden">
            <GlassAccent variant="sphere" className="w-32 h-32 -right-6 -bottom-10 absolute opacity-60" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
              <div>
                <h2 className="text-3xl font-bold text-white editorial">{profile.name}</h2>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="badge-blue">{profile.team}</span>
                  <span className="text-sm text-stone-400">Age {Number(profile.player_age).toFixed(0)}</span>
                  <span className="text-sm text-stone-400">{profile.total_games} games tracked</span>
                </div>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="stat-label">Season Accuracy</p>
                  <p className={`text-2xl font-bold font-display ${
                    profile.season_accuracy >= 60 ? 'text-emerald-400' :
                    profile.season_accuracy >= 50 ? 'text-gold' :
                    'text-ember-bright'
                  }`}>{profile.season_accuracy}%</p>
                </div>
                <div className="text-center">
                  <p className="stat-label">Avg Fatigue</p>
                  <p className="text-2xl font-bold text-gold font-display">{profile.avg_fatigue_score}</p>
                </div>
              </div>
            </div>
          </Reveal>

          <WaveDivider height={52} color="rgba(255,107,53,0.06)" />

          {/* Fatigue timeline */}
          <Reveal className="card p-6" y={32}>
            <div className="flex items-baseline gap-3 mb-1">
              <h3 className="text-xl font-bold text-white editorial">Fatigue Risk — Season Timeline</h3>
            </div>
            <p className="text-xs text-stone-500 mb-5">
              Click any point to jump to that game below. Red = high fatigue (≥70), gold = moderate (≥45).
            </p>
            <FatigueTimeline games={profile.games} onJump={jumpToGame} />
          </Reveal>

          {/* Highest fatigue games */}
          {worstFatigueGames.length > 0 && (
            <Reveal className="card p-5" y={32}>
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2.5 editorial">
                <RoughCircle className="w-7 h-7 shrink-0">
                  <AlertTriangle size={15} className="text-ember-bright" />
                </RoughCircle>
                Highest Fatigue Games
              </h3>
              <p className="text-xs text-stone-500 mb-4 pl-9">Tap a card to find it in the game log below.</p>
              <Stagger className="grid sm:grid-cols-3 gap-3">
                {worstFatigueGames.map(g => (
                  <Item key={g.game_id}>
                    <Pressable
                      onClick={() => jumpToGame(g.game_id)}
                      ariaLabel={`Jump to the ${g.date} game vs ${g.opponent}`}
                      className="block w-full bg-court-bg/60 backdrop-blur-sm rounded-xl p-3 border border-ember/15 hover:border-ember/40 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs text-stone-400">{g.date}</span>
                        <span className="text-xs font-medium text-stone-300">vs {g.opponent}</span>
                      </div>
                      <FatigueMeter score={g.fatigue_risk_score} size="md" />
                      <div className="flex items-center justify-between mt-2 text-xs text-stone-500">
                        <span>{(g.minutes_q1q3 ?? 0).toFixed(0)} min</span>
                        {g.is_back_to_back && <span className="text-ember-bright font-medium">B2B</span>}
                        <span>{g.rest_days}d rest</span>
                      </div>
                    </Pressable>
                  </Item>
                ))}
              </Stagger>
            </Reveal>
          )}

          {/* Full game table */}
          <Reveal className="card p-6" y={32}>
            <div className="flex items-baseline gap-3 mb-5">
              <h3 className="text-xl font-bold text-white editorial">All Games</h3>
              <span className="text-xs text-stone-500">Click a date to see that night's slate · headers to sort</span>
            </div>
            <GameTable games={profile.games} highlightedGameId={highlightedGameId} onDateJump={jumpToDate} />
          </Reveal>
        </div>
      )}

      {/* Empty state */}
      {!profile && !loading && !error && (
        <div className="text-center py-16 text-stone-500 animate-fade-in relative">
          <div className="w-16 h-16 rounded-[40%] bg-ember/10 border border-ember/15 flex items-center justify-center mx-auto mb-4 animate-blob-morph">
            <User size={28} className="text-ember/60" />
          </div>
          <p className="text-xl font-serif italic text-stone-200 mb-1">Pick a player, and we'll trace their season.</p>
          <p className="text-sm mb-6">Every game, every fatigue spike, every Q4 call — laid out end to end.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_SEARCH.map(n => (
              <button
                key={n}
                onClick={() => loadPlayer(n)}
                className="px-3.5 py-1.5 rounded-full text-xs text-ember-bright bg-ember/10 hover:bg-ember/20 border border-ember/20 transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

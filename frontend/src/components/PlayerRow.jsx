import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, ArrowUpRight } from 'lucide-react'
import { Pressable } from '../motion/Pressable'
import FatigueMeter from './FatigueMeter'

export default function PlayerRow({ player }) {
  const navigate = useNavigate()
  const correct = player.prediction_correct
  const drop = player.predicted_q4_dropoff ?? 0
  const actual = player.actual_q4_dropoff ?? 0
  const minutes = player.minutes_q1q3 ?? 0

  const dropLabel = `${drop >= 0 ? '+' : ''}${drop.toFixed(3)}`
  const actualLabel = `${actual >= 0 ? '+' : ''}${actual.toFixed(3)}`

  function openProfile() {
    navigate(`/player/${encodeURIComponent(player.player_name)}`)
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2.5 px-4 hover:bg-ember/[0.04] rounded-lg transition-colors">
      {/* Player name → profile */}
      <div className="col-span-3 flex items-center gap-2 min-w-0">
        {correct ? (
          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
        ) : (
          <XCircle size={14} className="text-ember-bright shrink-0" />
        )}
        <Pressable
          onClick={openProfile}
          ariaLabel={`View ${player.player_name}'s profile`}
          className="min-w-0 rounded-lg -mx-1 px-1 py-0.5 group"
        >
          <p className="text-sm font-medium text-stone-200 truncate flex items-center gap-1 group-hover:text-ember-bright transition-colors">
            <span className="truncate group-hover:underline decoration-ember/50 underline-offset-2">{player.player_name}</span>
            <ArrowUpRight size={12} className="shrink-0 text-ember opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
          <p className="text-xs text-stone-500">{player.team}</p>
        </Pressable>
      </div>

      {/* Fatigue meter */}
      <div className="col-span-2">
        <FatigueMeter score={player.fatigue_risk_score} size="sm" />
      </div>

      {/* Context */}
      <div className="col-span-2 flex flex-col gap-0.5">
        <span className="text-xs text-stone-400">{minutes.toFixed(0)} min Q1–Q3</span>
        <div className="flex items-center gap-1">
          {player.is_back_to_back && (
            <span className="badge-red text-[10px] px-1.5 py-0">B2B</span>
          )}
          <span className="text-xs text-stone-500">{player.rest_days}d rest</span>
        </div>
      </div>

      {/* Predicted dropoff */}
      <div
        className="col-span-2 text-center"
        title="Predicted Q4 scoring rate change vs Q1-Q3 average (negative = predicted fatigue drop-off)"
      >
        <p className="text-xs text-stone-500 mb-0.5">Predicted</p>
        <p className={`text-sm font-mono font-medium ${drop < 0 ? 'text-ember-bright' : 'text-stone-300'}`}>
          {dropLabel}
        </p>
      </div>

      {/* Actual dropoff */}
      <div
        className="col-span-2 text-center"
        title="Actual Q4 scoring rate vs Q1-Q3 average (negative = player did drop off in Q4)"
      >
        <p className="text-xs text-stone-500 mb-0.5">Actual</p>
        <p className={`text-sm font-mono font-medium ${actual < 0 ? 'text-ember-bright' : 'text-emerald-400'}`}>
          {actualLabel}
        </p>
      </div>

      {/* Q4 points */}
      <div className="col-span-1 text-right">
        <p className="text-xs text-stone-500 mb-0.5">Q4 pts</p>
        <p className="text-sm font-medium text-stone-200 stat-figure">{player.q4_points_actual ?? '—'}</p>
      </div>
    </div>
  )
}

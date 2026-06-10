import { CheckCircle, XCircle } from 'lucide-react'
import FatigueMeter from './FatigueMeter'

export default function PlayerRow({ player }) {
  const correct = player.prediction_correct
  const drop = player.predicted_q4_dropoff ?? 0
  const actual = player.actual_q4_dropoff ?? 0
  const minutes = player.minutes_q1q3 ?? 0

  const dropLabel = `${drop >= 0 ? '+' : ''}${drop.toFixed(3)}`
  const actualLabel = `${actual >= 0 ? '+' : ''}${actual.toFixed(3)}`

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2.5 px-4 hover:bg-white/3 rounded-lg transition-colors">
      {/* Player name + result icon */}
      <div className="col-span-3 flex items-center gap-2 min-w-0">
        {correct ? (
          <CheckCircle size={14} className="text-green-400 shrink-0" />
        ) : (
          <XCircle size={14} className="text-red-400 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{player.player_name}</p>
          <p className="text-xs text-slate-500">{player.team}</p>
        </div>
      </div>

      {/* Fatigue meter */}
      <div className="col-span-2">
        <FatigueMeter score={player.fatigue_risk_score} size="sm" />
      </div>

      {/* Context */}
      <div className="col-span-2 flex flex-col gap-0.5">
        <span className="text-xs text-slate-400">{minutes.toFixed(0)} min Q1–Q3</span>
        <div className="flex items-center gap-1">
          {player.is_back_to_back && (
            <span className="badge-red text-[10px] px-1.5 py-0">B2B</span>
          )}
          <span className="text-xs text-slate-500">{player.rest_days}d rest</span>
        </div>
      </div>

      {/* Predicted dropoff */}
      <div
        className="col-span-2 text-center"
        title="Predicted Q4 scoring rate change vs Q1-Q3 average (negative = predicted fatigue drop-off)"
      >
        <p className="text-xs text-slate-500 mb-0.5">Predicted</p>
        <p className={`text-sm font-mono font-medium ${drop < 0 ? 'text-red-400' : 'text-slate-300'}`}>
          {dropLabel}
        </p>
      </div>

      {/* Actual dropoff */}
      <div
        className="col-span-2 text-center"
        title="Actual Q4 scoring rate vs Q1-Q3 average (negative = player did drop off in Q4)"
      >
        <p className="text-xs text-slate-500 mb-0.5">Actual</p>
        <p className={`text-sm font-mono font-medium ${actual < 0 ? 'text-red-400' : 'text-green-400'}`}>
          {actualLabel}
        </p>
      </div>

      {/* Q4 points */}
      <div className="col-span-1 text-right">
        <p className="text-xs text-slate-500 mb-0.5">Q4 pts</p>
        <p className="text-sm font-medium text-slate-200">{player.q4_points_actual ?? '—'}</p>
      </div>
    </div>
  )
}

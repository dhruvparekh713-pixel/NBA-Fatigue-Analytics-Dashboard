import { CheckCircle, XCircle, Zap } from 'lucide-react'
import FatigueMeter from './FatigueMeter'

export default function PlayerRow({ player }) {
  const correct = player.prediction_correct
  const drop = player.predicted_q4_dropoff
  const actual = player.actual_q4_dropoff

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2.5 px-4 hover:bg-white/3 rounded-lg transition-colors group">
      {/* Player info */}
      <div className="col-span-3 flex items-center gap-2">
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
        <span className="text-xs text-slate-400">
          {player.minutes_q1q3.toFixed(0)} min Q1-Q3
        </span>
        <div className="flex items-center gap-1">
          {player.is_back_to_back && (
            <span className="badge-red text-[10px] px-1.5 py-0">B2B</span>
          )}
          <span className="text-xs text-slate-500">{player.rest_days}d rest</span>
        </div>
      </div>

      {/* Predicted drop */}
      <div className="col-span-2 text-center">
        <p className="text-xs text-slate-500">Predicted</p>
        <p className={`text-sm font-mono font-medium ${drop < 0 ? 'text-red-400' : 'text-slate-300'}`}>
          {drop >= 0 ? '+' : ''}{drop.toFixed(3)}
        </p>
      </div>

      {/* Actual drop */}
      <div className="col-span-2 text-center">
        <p className="text-xs text-slate-500">Actual</p>
        <p className={`text-sm font-mono font-medium ${actual < 0 ? 'text-red-400' : 'text-green-400'}`}>
          {actual >= 0 ? '+' : ''}{actual.toFixed(3)}
        </p>
      </div>

      {/* Q4 points */}
      <div className="col-span-1 text-right">
        <p className="text-xs text-slate-500">Q4 pts</p>
        <p className="text-sm font-medium text-slate-200">{player.q4_points_actual}</p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import PlayerRow from './PlayerRow'

function AccuracyRing({ pct }) {
  const color = pct >= 65 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold" style={{ color }}>{pct}%</span>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">accuracy</span>
    </div>
  )
}

export default function GameCard({ game, predictions }) {
  const [expanded, setExpanded] = useState(false)

  const gamePreds = predictions.filter(p => p.game_id === game.game_id)
  const home = game.home_team
  const away = game.away_team

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-left"
      >
        {/* Matchup */}
        <div className="flex-1 flex items-center gap-3">
          <div className="text-center min-w-[40px]">
            <p className="text-lg font-bold text-white">{away}</p>
            <p className="text-[10px] text-slate-500">AWAY</p>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-xs text-slate-500 font-medium">@</span>
          </div>
          <div className="text-center min-w-[40px]">
            <p className="text-lg font-bold text-white">{home}</p>
            <p className="text-[10px] text-slate-500">HOME</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <AccuracyRing pct={game.accuracy_pct} />
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white">{game.n_predictions}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">players</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-green-400">{game.correct}</span>
            <span className="text-[10px] text-slate-500">correct</span>
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-slate-500" />
          ) : (
            <ChevronDown size={16} className="text-slate-500" />
          )}
        </div>
      </button>

      {/* Player rows */}
      {expanded && gamePreds.length > 0 && (
        <div className="border-t border-white/5">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500">
            <div className="col-span-3">Player</div>
            <div className="col-span-2">Fatigue</div>
            <div className="col-span-2">Context</div>
            <div className="col-span-2 text-center">Predicted Δ</div>
            <div className="col-span-2 text-center">Actual Δ</div>
            <div className="col-span-1 text-right">Q4 Pts</div>
          </div>
          <div className="pb-2">
            {gamePreds
              .sort((a, b) => b.fatigue_risk_score - a.fatigue_risk_score)
              .map(p => (
                <PlayerRow key={`${p.player_name}-${p.game_id}`} player={p} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

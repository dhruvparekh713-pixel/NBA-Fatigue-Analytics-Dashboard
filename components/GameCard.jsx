import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import PlayerRow from './PlayerRow'

function AccuracyBadge({ pct }) {
  const color =
    pct >= 65 ? 'text-green-400 bg-green-500/10 border-green-500/20' :
    pct >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
    'text-red-400 bg-red-500/10 border-red-500/20'
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border ${color}`}>
      <span className="text-base font-bold leading-none">{pct}%</span>
      <span className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">accuracy</span>
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
          <div className="text-center min-w-[44px]">
            <p className="text-base font-bold text-white">{away}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Away</p>
          </div>
          <span className="text-xs text-slate-600 font-medium">@</span>
          <div className="text-center min-w-[44px]">
            <p className="text-base font-bold text-white">{home}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Home</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <AccuracyBadge pct={game.accuracy_pct} />
          <div className="hidden sm:flex flex-col items-center">
            <span className="text-base font-bold text-white">{game.n_predictions}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">players</span>
          </div>
          <div className="hidden sm:flex flex-col items-center">
            <span className="text-sm font-bold text-green-400">{game.correct}</span>
            <span className="text-[10px] text-slate-500">correct</span>
          </div>
          <div className="text-slate-500 ml-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {/* Expandable player rows — fade in on open */}
      {expanded && gamePreds.length > 0 && (
        <div className="border-t border-white/5 animate-fade-in">
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

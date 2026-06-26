import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion, buoyant, springs } from '../motion/primitives'
import PlayerRow from './PlayerRow'

function AccuracyBadge({ pct }) {
  const color =
    pct >= 65 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
    pct >= 50 ? 'text-gold bg-gold/10 border-gold/20' :
    'text-ember-bright bg-ember/10 border-ember/25'
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border ${color}`}>
      <span className="text-base font-bold leading-none stat-figure">{pct}%</span>
      <span className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">accuracy</span>
    </div>
  )
}

export default function GameCard({ game, predictions }) {
  const [expanded, setExpanded] = useState(false)
  const reduce = useReducedMotion()

  const gamePreds = predictions.filter(p => p.game_id === game.game_id)
  const home = game.home_team
  const away = game.away_team

  return (
    <motion.div
      layout={!reduce}
      transition={springs.soft}
      className={`card overflow-hidden ${expanded ? 'border-ember/25 shadow-glow-ember' : ''}`}
      {...(expanded ? {} : buoyant(reduce))}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors text-left"
      >
        {/* Matchup */}
        <div className="flex-1 flex items-center gap-3">
          <div className="text-center min-w-[44px]">
            <p className="text-base font-bold text-white font-display">{away}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider">Away</p>
          </div>
          <span className="text-xs text-ember/60 font-bold">@</span>
          <div className="text-center min-w-[44px]">
            <p className="text-base font-bold text-white font-display">{home}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider">Home</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <AccuracyBadge pct={game.accuracy_pct} />
          <div className="hidden sm:flex flex-col items-center">
            <span className="text-base font-bold text-white stat-figure">{game.n_predictions}</span>
            <span className="text-[10px] text-stone-500 uppercase tracking-wider">players</span>
          </div>
          <div className="hidden sm:flex flex-col items-center">
            <span className="text-sm font-bold text-emerald-400 stat-figure">{game.correct}</span>
            <span className="text-[10px] text-stone-500">correct</span>
          </div>
          <motion.div
            className="text-ember/70 ml-1"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={springs.snappy}
          >
            <ChevronDown size={16} />
          </motion.div>
        </div>
      </button>

      {/* Expandable player rows — fluid height grow */}
      <AnimatePresence initial={false}>
        {expanded && gamePreds.length > 0 && (
          <motion.div
            key="rows"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={reduce ? {} : { height: 'auto', opacity: 1 }}
            exit={reduce ? {} : { height: 0, opacity: 0 }}
            transition={{ ...springs.soft, opacity: { duration: 0.2 } }}
            className="border-t border-white/[0.06] overflow-hidden"
          >
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-stone-500">
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

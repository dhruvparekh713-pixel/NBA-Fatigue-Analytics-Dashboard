import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import StatsOverview from '../components/StatsOverview'
import DatePicker from '../components/DatePicker'
import GameCard from '../components/GameCard'
import { Reveal, Stagger, Item } from '../motion/primitives'
import { WaveDivider } from '../components/decor'
import { AlertCircle, CheckCircle2, Hash } from 'lucide-react'

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card h-20 animate-pulse" />
      ))}
    </div>
  )
}

function SummaryBar({ games, predictions }) {
  if (predictions.length === 0) return null
  const correct = predictions.filter(p => p.prediction_correct).length
  const pct = Math.round(correct / predictions.length * 100)
  const color = pct >= 60 ? 'text-emerald-400' : pct >= 50 ? 'text-gold' : 'text-ember-bright'

  return (
    <div className="flex items-center gap-5 px-1 mb-3 text-sm">
      <span className="flex items-center gap-1.5 text-stone-400">
        <Hash size={13} className="text-ember/60" />
        <span className="font-semibold text-white stat-figure">{games.length}</span> games
      </span>
      <span className="flex items-center gap-1.5 text-stone-400">
        <Hash size={13} className="text-ember/60" />
        <span className="font-semibold text-white stat-figure">{predictions.length}</span> predictions
      </span>
      <span className="flex items-center gap-1.5 text-stone-400">
        <CheckCircle2 size={13} className="text-ember/60" />
        Daily accuracy:{' '}
        <span className={`font-semibold stat-figure ${color}`}>{pct}%</span>
      </span>
    </div>
  )
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [games, setGames] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getDates().then(r => {
      const d = r.dates || []
      setDates(d)
      // A ?date= deep-link wins on load (e.g. arriving from a player's game log);
      // otherwise default to the most recent date with games.
      const requested = searchParams.get('date')
      if (requested && d.includes(requested)) setSelectedDate(requested)
      else if (d.length > 0) setSelectedDate(d[d.length - 1])
    })
  }, [])

  // Keep deep-links in sync when arriving with a new ?date= (e.g. clicking
  // another date from a player profile while the Dashboard is already mounted).
  useEffect(() => {
    const requested = searchParams.get('date')
    if (requested && dates.includes(requested) && requested !== selectedDate) {
      setSelectedDate(requested)
    }
  }, [searchParams, dates])

  function chooseDate(d) {
    setSelectedDate(d)
    // reflect the active date in the URL without stacking history entries
    setSearchParams(d ? { date: d } : {}, { replace: true })
  }

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    setError(null)
    Promise.all([
      api.getGames(selectedDate),
      api.getPredictions(selectedDate),
    ])
      .then(([gamesRes, predsRes]) => {
        setGames(gamesRes.games || [])
        setPredictions(predsRes.predictions || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedDate])

  const selectedLabel = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : ''

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Hero stats */}
      <section>
        <Reveal>
          <div className="flex items-baseline gap-3 mb-5">
            <h1 className="text-4xl font-bold text-white editorial">Model Performance</h1>
            <span className="text-sm text-stone-500 italic font-serif">2024–25 Season</span>
          </div>
        </Reveal>
        <StatsOverview />
      </section>

      {/* Asymmetric wave transition into the body */}
      <WaveDivider height={64} />

      {/* Game results by date — de-boxed, blob-backed */}
      <section className="relative">
        <Reveal>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-3xl font-bold text-white editorial">Game Results</h2>
              <p className="text-sm text-stone-500 mt-1">Quarter-by-quarter fatigue calls, game by game.</p>
            </div>
            {selectedLabel && (
              <span className="text-xs text-stone-500 italic font-serif">{selectedLabel}</span>
            )}
          </div>

          {/* date strip floats on the page, not in a hard box */}
          <div className="mb-6 overflow-x-auto rounded-2xl bg-white/[0.02] px-2 py-2">
            <DatePicker dates={dates} selected={selectedDate} onChange={chooseDate} />
          </div>
        </Reveal>

        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-stone-400 py-12 text-center">
            <AlertCircle size={20} className="text-ember-bright" />
            <span className="text-sm">We fumbled that one — couldn't pull the games. Give it a moment and try again.</span>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <p className="text-lg font-serif italic text-stone-300">The players are resting.</p>
            <p className="text-sm mt-1">No games on the slate for this date — check another night.</p>
          </div>
        ) : (
          <div>
            <SummaryBar games={games} predictions={predictions} />
            {/* key forces re-stagger when the date changes */}
            <Stagger key={selectedDate} className="space-y-3">
              {games.map((game, i) => (
                <Item
                  key={game.game_id}
                  className={i % 2 === 1 ? 'lg:ml-8' : 'lg:mr-8'}
                >
                  <GameCard game={game} predictions={predictions} />
                </Item>
              ))}
            </Stagger>
          </div>
        )}
      </section>
    </div>
  )
}

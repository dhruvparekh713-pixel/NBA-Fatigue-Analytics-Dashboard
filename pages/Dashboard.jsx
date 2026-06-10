import { useEffect, useState } from 'react'
import { api } from '../api'
import StatsOverview from '../components/StatsOverview'
import DatePicker from '../components/DatePicker'
import GameCard from '../components/GameCard'
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
  const color = pct >= 60 ? 'text-green-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="flex items-center gap-5 px-1 mb-3 text-sm animate-fade-in">
      <span className="flex items-center gap-1.5 text-slate-400">
        <Hash size={13} className="text-slate-600" />
        <span className="font-semibold text-white">{games.length}</span> games
      </span>
      <span className="flex items-center gap-1.5 text-slate-400">
        <Hash size={13} className="text-slate-600" />
        <span className="font-semibold text-white">{predictions.length}</span> predictions
      </span>
      <span className="flex items-center gap-1.5 text-slate-400">
        <CheckCircle2 size={13} className="text-slate-600" />
        Daily accuracy:{' '}
        <span className={`font-semibold ${color}`}>{pct}%</span>
      </span>
    </div>
  )
}

export default function Dashboard() {
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
      if (d.length > 0) setSelectedDate(d[d.length - 1])
    })
  }, [])

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Hero stats */}
      <section>
        <div className="flex items-baseline gap-3 mb-5">
          <div className="section-header">
            <h1 className="text-2xl font-bold text-white">Model Performance</h1>
          </div>
          <span className="text-sm text-slate-500">2024–25 Season</span>
        </div>
        <StatsOverview />
      </section>

      {/* Game results by date */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="section-header">
            <h2 className="text-lg font-semibold text-white">Game Results</h2>
          </div>
          {selectedLabel && (
            <span className="text-xs text-slate-500">{selectedLabel}</span>
          )}
        </div>

        <div className="card p-4 mb-5 overflow-x-auto">
          <DatePicker dates={dates} selected={selectedDate} onChange={setSelectedDate} />
        </div>

        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 py-8 justify-center">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm animate-fade-in">
            No games found for this date.
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <SummaryBar games={games} predictions={predictions} />
            {games.map(game => (
              <GameCard
                key={game.game_id}
                game={game}
                predictions={predictions}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

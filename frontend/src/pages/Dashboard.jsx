import { useEffect, useState } from 'react'
import { api } from '../api'
import StatsOverview from '../components/StatsOverview'
import DatePicker from '../components/DatePicker'
import GameCard from '../components/GameCard'
import { AlertCircle, Loader2 } from 'lucide-react'

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card h-20 animate-pulse" />
      ))}
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

  // Load available dates
  useEffect(() => {
    api.getDates().then(r => {
      const d = r.dates || []
      setDates(d)
      // Default to last date with games
      if (d.length > 0) setSelectedDate(d[d.length - 1])
    })
  }, [])

  // Load games + predictions when date changes
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero stats */}
      <section>
        <div className="flex items-baseline gap-3 mb-5">
          <h1 className="text-2xl font-bold text-white">Model Performance</h1>
          <span className="text-sm text-slate-500">2024-25 Season</span>
        </div>
        <StatsOverview />
      </section>

      {/* Date picker */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Game Results</h2>
          {selectedDate && (
            <span className="text-xs text-slate-500">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          )}
        </div>
        <div className="card p-4 mb-6 overflow-x-auto">
          <DatePicker dates={dates} selected={selectedDate} onChange={setSelectedDate} />
        </div>

        {/* Games */}
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 py-8 justify-center">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No games found for this date.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary bar */}
            {predictions.length > 0 && (
              <div className="flex items-center gap-6 px-1 mb-2">
                <span className="text-sm text-slate-400">
                  <span className="text-white font-semibold">{games.length}</span> games
                </span>
                <span className="text-sm text-slate-400">
                  <span className="text-white font-semibold">{predictions.length}</span> predictions
                </span>
                <span className="text-sm text-slate-400">
                  Accuracy:{' '}
                  <span className={`font-semibold ${
                    (predictions.filter(p => p.prediction_correct).length / predictions.length) >= 0.6
                      ? 'text-green-400'
                      : 'text-amber-400'
                  }`}>
                    {Math.round(predictions.filter(p => p.prediction_correct).length / predictions.length * 100)}%
                  </span>
                </span>
              </div>
            )}

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

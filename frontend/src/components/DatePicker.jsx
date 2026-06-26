import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, ChevronsRight } from 'lucide-react'

export default function DatePicker({ dates, selected, onChange }) {
  const [visibleStart, setVisibleStart] = useState(0)
  const VISIBLE = 7

  useEffect(() => {
    if (!selected || dates.length === 0) return
    const idx = dates.indexOf(selected)
    if (idx >= 0 && (idx < visibleStart || idx >= visibleStart + VISIBLE)) {
      setVisibleStart(Math.max(0, idx - Math.floor(VISIBLE / 2)))
    }
  }, [selected, dates])

  if (dates.length === 0) {
    return <div className="h-16 animate-pulse rounded-xl bg-bg-card" />
  }

  const visible = dates.slice(visibleStart, visibleStart + VISIBLE)
  const canPrev = visibleStart > 0
  const canNext = visibleStart + VISIBLE < dates.length
  const isAtLatest = selected === dates[dates.length - 1]

  function fmtDay(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
  }
  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  function fmtMonth(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  function jumpToLatest() {
    const lastIdx = dates.length - 1
    setVisibleStart(Math.max(0, lastIdx - Math.floor(VISIBLE / 2)))
    onChange(dates[lastIdx])
  }

  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
      {/* Month label */}
      <div className="flex items-center gap-1.5 text-slate-400 text-xs shrink-0 mr-1">
        <Calendar size={13} />
        <span>{fmtMonth(visible[0])}</span>
      </div>

      <button
        onClick={() => setVisibleStart(v => Math.max(0, v - VISIBLE))}
        disabled={!canPrev}
        className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-25 transition-colors shrink-0"
        title="Previous dates"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex gap-1.5 flex-1 justify-start overflow-x-auto">
        {visible.map(d => {
          const isSelected = d === selected
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-bg-card hover:bg-bg-elevated text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              <span className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                {fmtDay(d)}
              </span>
              <span className="text-sm font-bold mt-0.5">{fmtDate(d)}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => setVisibleStart(v => Math.min(dates.length - VISIBLE, v + VISIBLE))}
        disabled={!canNext}
        className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-25 transition-colors shrink-0"
        title="Next dates"
      >
        <ChevronRight size={16} />
      </button>

      {!isAtLatest && (
        <button
          onClick={jumpToLatest}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-blue-400 hover:bg-blue-600/10 border border-blue-500/25 transition-colors shrink-0"
          title="Jump to most recent date"
        >
          <ChevronsRight size={12} />
          Latest
        </button>
      )}
    </div>
  )
}

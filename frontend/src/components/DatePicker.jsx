import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

export default function DatePicker({ dates, selected, onChange }) {
  const [visibleStart, setVisibleStart] = useState(0)
  const VISIBLE = 7

  // Jump to selected date when it changes externally
  useEffect(() => {
    if (!selected || dates.length === 0) return
    const idx = dates.indexOf(selected)
    if (idx >= 0 && (idx < visibleStart || idx >= visibleStart + VISIBLE)) {
      setVisibleStart(Math.max(0, idx - Math.floor(VISIBLE / 2)))
    }
  }, [selected, dates])

  if (dates.length === 0) {
    return <div className="h-16 card animate-pulse" />
  }

  const visible = dates.slice(visibleStart, visibleStart + VISIBLE)
  const canPrev = visibleStart > 0
  const canNext = visibleStart + VISIBLE < dates.length

  function fmtDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }
  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  function fmtMonth(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short' })
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-slate-400 text-sm mr-2 shrink-0">
        <Calendar size={14} />
        <span>{fmtMonth(visible[0])} {new Date(visible[0] + 'T00:00:00').getFullYear()}</span>
      </div>

      <button
        onClick={() => setVisibleStart(v => Math.max(0, v - VISIBLE))}
        disabled={!canPrev}
        className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex gap-1.5">
        {visible.map(d => {
          const isSelected = d === selected
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
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
        className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

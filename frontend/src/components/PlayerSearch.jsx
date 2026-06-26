import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../api'

export default function PlayerSearch({ onSelect, placeholder = 'Search players...' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const ref = useRef(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setFocusedIdx(-1)
      return
    }
    const t = setTimeout(() => {
      api.searchPlayers(query).then(r => {
        setResults(r.players || [])
        setOpen(true)
        setFocusedIdx(-1)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleKeyDown(e) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      select(results[focusedIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function select(name) {
    onSelect(name)
    setQuery('')
    setOpen(false)
    setFocusedIdx(-1)
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-court-surface border border-court-line rounded-xl pl-9 pr-4 py-2.5 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-ember/60 focus:ring-1 focus:ring-ember/30 transition-all"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-court-elevated border border-court-line rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          {results.map((name, i) => (
            <button
              key={name}
              onMouseDown={() => select(name)}
              onMouseEnter={() => setFocusedIdx(i)}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                i === focusedIdx
                  ? 'bg-ember/15 text-ember-bright'
                  : 'text-stone-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {name}
            </button>
          ))}
          <p className="px-4 py-1.5 text-[10px] text-stone-600 border-t border-court-line">
            ↑↓ navigate · Enter select · Esc close
          </p>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../api'

export default function PlayerSearch({ onSelect, placeholder = 'Search players...' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      api.searchPlayers(query).then(r => {
        setResults(r.players || [])
        setOpen(true)
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

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-bg-card border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-bg-elevated border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {results.map(name => (
            <button
              key={name}
              onMouseDown={() => {
                onSelect(name)
                setQuery('')
                setOpen(false)
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

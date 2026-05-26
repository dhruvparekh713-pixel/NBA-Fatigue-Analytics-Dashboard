const BASE = import.meta.env.VITE_API_URL || ''

async function request(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  getDates: () => request('/api/dates'),
  getGames: (date) => request(`/api/games/${date}`),
  getPredictions: (date) => request(`/api/predictions/${date}`),
  getPlayer: (name) => request(`/api/player/${encodeURIComponent(name)}`),
  searchPlayers: (q) => request(`/api/players/search?q=${encodeURIComponent(q)}`),
  getCumulativeAccuracy: () => request('/api/accuracy/cumulative'),
  getSegmentAccuracy: () => request('/api/accuracy/segments'),
  getOverview: () => request('/api/stats/overview'),
}

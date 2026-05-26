import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Accuracy from './pages/Accuracy'
import PlayerProfile from './pages/PlayerProfile'
import { Activity, BarChart2, User } from 'lucide-react'

function Nav() {
  const links = [
    { to: '/', label: 'Dashboard', icon: Activity },
    { to: '/accuracy', label: 'Accuracy', icon: BarChart2 },
    { to: '/player', label: 'Player Search', icon: User },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-8">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Activity size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm text-white tracking-tight">
            NBA<span className="text-blue-400"> Fatigue</span>
          </span>
        </div>

        {/* Links */}
        <div className="flex gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Spacer + badge */}
        <div className="ml-auto">
          <span className="text-xs text-slate-500 hidden sm:block">
            2024-25 Season · XGBoost Model
          </span>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/5 mt-16 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          Built by{' '}
          <span className="text-slate-300 font-medium">Dhruv Parekh</span>
          {' '}— CMU ECE '28
        </span>
        <a
          href="https://github.com/dhirp007"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
        >
          GitHub →
        </a>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/player" element={<PlayerProfile />} />
            <Route path="/player/:name" element={<PlayerProfile />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

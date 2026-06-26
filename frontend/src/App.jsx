import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Accuracy from './pages/Accuracy'
import PlayerProfile from './pages/PlayerProfile'
import { api } from './api'
import useCountUp from './hooks/useCountUp'
import { motion, AnimatePresence, useReducedMotion, Float } from './motion/primitives'
import { LiquidBlobs, GlassShapes } from './components/decor'
import { Flame, BarChart2, User } from 'lucide-react'

function IndicatorChip({ label, value, decimals = 0, suffix = '', accent = 'text-white' }) {
  const animated = useCountUp(value, { duration: 1000, decimals })
  const display = decimals > 0 ? animated.toFixed(decimals) : Math.round(animated).toLocaleString()
  return (
    <div className="flex flex-col items-end leading-none">
      <span className={`text-sm font-bold stat-figure ${accent}`}>
        {display}{suffix}
      </span>
      <span className="text-[9px] text-stone-500 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  )
}

function LeagueIndicators() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getOverview().then(setData).catch(() => {})
  }, [])

  if (!data) {
    return (
      <div className="hidden md:flex items-center gap-5">
        <div className="h-7 w-16 rounded bg-court-elevated animate-pulse" />
        <div className="h-7 w-14 rounded bg-court-elevated animate-pulse" />
      </div>
    )
  }

  return (
    <div className="hidden md:flex items-center gap-5 animate-fade-in-1">
      <IndicatorChip label="Accuracy" value={data.overall_accuracy} decimals={1} suffix="%" accent="text-ember-bright" />
      <div className="w-px h-6 bg-court-line" />
      <IndicatorChip label="Games" value={data.total_games} accent="text-gold" />
      <div className="w-px h-6 bg-court-line" />
      <IndicatorChip label="Predictions" value={data.total_predictions} accent="text-stone-200" />
    </div>
  )
}

function Nav() {
  const links = [
    { to: '/', label: 'Dashboard', icon: Flame },
    { to: '/accuracy', label: 'Accuracy', icon: BarChart2 },
    { to: '/player', label: 'Players', icon: User },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-court-black/70 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-8">
          <Float distance={4} duration={3.5}>
            <div className="w-9 h-9 rounded-xl bg-ember-gold flex items-center justify-center shadow-glow-ember">
              <Flame size={17} className="text-court-black" />
            </div>
          </Float>
          <div className="flex flex-col leading-none">
            <span className="font-serif font-bold text-lg text-white tracking-tight">
              NBA <span className="gradient-text-ember italic">Fatigue</span>
            </span>
            <span className="text-[9px] text-stone-500 uppercase tracking-[0.2em]">Analytics Terminal</span>
          </div>
        </div>

        {/* Links */}
        <div className="flex gap-0.5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-ember/15 text-ember-bright'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* League indicators */}
        <div className="ml-auto flex items-center gap-5">
          <LeagueIndicators />
          <div className="hidden sm:flex items-center gap-2 pl-5 border-l border-court-line">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ember opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember" />
            </span>
            <span className="text-[10px] text-stone-500 uppercase tracking-wider">2024–25</span>
          </div>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-16 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs text-stone-500">
          Built by{' '}
          <span className="text-stone-300 font-medium">Dhruv Parekh</span>
          {' '}— CMU ECE '28
        </span>
        <a
          href="https://github.com/dhruvparekh713-pixel/NBA-Fatigue-Analytics-Dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-ember hover:text-ember-bright transition-colors"
        >
          GitHub →
        </a>
      </div>
    </footer>
  )
}

/* Fluid route transitions — cross-fade + small rise */
function AnimatedRoutes() {
  const location = useLocation()
  const reduce = useReducedMotion()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={reduce ? {} : { opacity: 1, y: 0 }}
        exit={reduce ? {} : { opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accuracy" element={<Accuracy />} />
          <Route path="/player" element={<PlayerProfile />} />
          <Route path="/player/:name" element={<PlayerProfile />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LiquidBlobs />
      <GlassShapes />
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">
          <AnimatedRoutes />
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

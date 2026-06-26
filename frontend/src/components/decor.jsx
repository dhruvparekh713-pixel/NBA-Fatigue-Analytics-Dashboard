import { motion, useReducedMotion } from '../motion/primitives'

/**
 * Organic editorial decor — liquid blobs, frosted-glass 3D shapes, wave
 * dividers, and hand-drawn SVG accents. All pure SVG/CSS, no new deps.
 * Everything honors reduced-motion.
 */

/* ----------------------------------------------------------------------------
 * LiquidBlobs — slow morphing, drifting, ultra-low-opacity color fields.
 * Fixed full-screen background layer (use once in App).
 * ------------------------------------------------------------------------- */
export function LiquidBlobs() {
  const reduce = useReducedMotion()
  const blobs = [
    { c: 'bg-ember/[0.14]', s: 'top-[-12%] right-[-8%] w-[46rem] h-[46rem]', y: [0, 50, 0], x: [0, -36, 0], d: 20 },
    { c: 'bg-[#c0392b]/[0.10]', s: 'bottom-[-18%] left-[-12%] w-[42rem] h-[42rem]', y: [0, -54, 0], x: [0, 44, 0], d: 24 },
    { c: 'bg-gold/[0.08]', s: 'top-[38%] left-[52%] w-[34rem] h-[34rem]', y: [0, 40, 0], x: [0, -48, 0], d: 28 },
    { c: 'bg-ember-deep/[0.10]', s: 'top-[60%] left-[-6%] w-[30rem] h-[30rem]', y: [0, -30, 0], x: [0, 30, 0], d: 22 },
  ]
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute blur-[130px] ${b.c} ${b.s} ${reduce ? 'rounded-full' : 'animate-blob-morph'}`}
          style={reduce ? undefined : { animationDelay: `${i * -4}s` }}
          animate={reduce ? undefined : { y: b.y, x: b.x }}
          transition={{ duration: b.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * GlassShapes — frosted-glass spheres & rings floating in the background.
 * Fixed layer; content scrolling over them reads as layered depth.
 * ------------------------------------------------------------------------- */
function Sphere({ className, dur = 9, dist = 14 }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={`absolute rounded-full ${className}`}
      style={{
        background:
          'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 42%, rgba(255,107,53,0.05) 100%)',
        boxShadow: 'inset 0 1px 12px rgba(255,255,255,0.12), inset 0 -14px 30px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(2px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      animate={reduce ? undefined : { y: [0, -dist, 0] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

function Ring({ className, dur = 11, dist = 18 }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={`absolute rounded-full ${className}`}
      style={{
        border: '1.5px solid rgba(255,255,255,0.10)',
        boxShadow: 'inset 0 0 24px rgba(255,140,66,0.10), 0 0 30px rgba(255,107,53,0.06)',
        backdropFilter: 'blur(1px)',
      }}
      animate={reduce ? undefined : { y: [0, dist, 0], rotate: [0, 8, 0] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

export function GlassShapes() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <Sphere className="top-[14%] left-[8%] w-28 h-28" dur={8} dist={12} />
      <Ring className="top-[24%] right-[12%] w-44 h-44" dur={13} dist={20} />
      <Sphere className="top-[62%] right-[18%] w-20 h-20" dur={10} dist={16} />
      <Ring className="bottom-[12%] left-[22%] w-32 h-32" dur={12} dist={14} />
      <Sphere className="bottom-[26%] left-[46%] w-16 h-16" dur={9} dist={10} />
    </div>
  )
}

/* Local glass accents for a specific section (absolutely positioned within
 * a `relative` parent). */
export function GlassAccent({ className = '', variant = 'sphere' }) {
  return variant === 'ring'
    ? <Ring className={className} />
    : <Sphere className={className} />
}

/* ----------------------------------------------------------------------------
 * WaveDivider — asymmetric smooth bezier wave between sections.
 * ------------------------------------------------------------------------- */
export function WaveDivider({ flip = false, className = '', color = 'rgba(255,107,53,0.06)', height = 70 }) {
  return (
    <div
      className={`w-full overflow-hidden leading-none pointer-events-none ${flip ? 'rotate-180' : ''} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <path
          d="M0,64 C180,110 320,12 540,40 C760,68 900,128 1200,56 L1200,120 L0,120 Z"
          fill={color}
        />
        <path
          d="M0,80 C220,40 420,118 660,78 C880,42 1040,96 1200,72"
          fill="none"
          stroke="rgba(255,140,66,0.18)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * HandUnderline — hand-drawn squiggly underline that draws in on view.
 * ------------------------------------------------------------------------- */
export function HandUnderline({ className = '', color = '#ff8c42', width = 200 }) {
  const reduce = useReducedMotion()
  return (
    <svg
      className={className}
      width={width}
      height="14"
      viewBox="0 0 200 14"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <motion.path
        d="M3 8 C40 2, 70 12, 104 7 C140 2, 168 11, 197 5"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        whileInView={reduce ? {} : { pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.2 }}
      />
    </svg>
  )
}

/* ----------------------------------------------------------------------------
 * RoughCircle — hand-drawn looping circle that frames an alert/badge.
 * Wrap around children; the loop draws in on view.
 * ------------------------------------------------------------------------- */
export function RoughCircle({ children, color = '#ff5630', className = '' }) {
  const reduce = useReducedMotion()
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {children}
      <svg
        className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <motion.path
          d="M50 6 C78 4, 96 22, 95 48 C94 76, 72 95, 47 94 C20 93, 4 72, 6 46 C8 22, 26 8, 52 7"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          whileInView={reduce ? {} : { pathLength: 1, opacity: 0.9 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: 'easeInOut' }}
        />
      </svg>
    </span>
  )
}

import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 (or a given start) up to `target` on mount /
 * whenever `target` changes. Purely a display helper — it does not touch
 * any underlying data or state.
 *
 * @param {number} target    final value to count up to
 * @param {object} [opts]
 * @param {number} [opts.duration=900]  animation length in ms
 * @param {number} [opts.decimals=0]    decimal places to render
 * @returns {number} the current animated value
 */
export default function useCountUp(target, { duration = 900, decimals = 0 } = {}) {
  const safeTarget = Number.isFinite(target) ? target : 0
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)
  const startTsRef = useRef(null)

  useEffect(() => {
    // Respect reduced-motion preference — jump straight to the value.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced || duration <= 0) {
      setValue(safeTarget)
      return
    }

    const from = 0
    startTsRef.current = null

    function tick(ts) {
      if (startTsRef.current === null) startTsRef.current = ts
      const elapsed = ts - startTsRef.current
      const t = Math.min(1, elapsed / duration)
      // easeOutCubic for a snappy, decelerating count
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (safeTarget - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setValue(safeTarget)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [safeTarget, duration])

  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

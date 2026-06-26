import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { springs } from './primitives'

/**
 * useRipple — tactile ember ripple that radiates from the exact click point.
 * Returns a pointer-down handler and a layer to render inside a
 * `relative overflow-hidden` element. Honors reduced-motion (no-op).
 */
export function useRipple({ color = 'rgba(255,107,53,0.45)' } = {}) {
  const reduce = useReducedMotion()
  const [ripples, setRipples] = useState([])
  const idRef = useRef(0)

  function spawn(e) {
    if (reduce) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // size = diameter that covers the farthest corner from the click
    const size = Math.max(
      Math.hypot(x, y),
      Math.hypot(rect.width - x, y),
      Math.hypot(x, rect.height - y),
      Math.hypot(rect.width - x, rect.height - y),
    ) * 2
    const id = idRef.current++
    setRipples(r => [...r, { id, x, y, size }])
  }

  function remove(id) {
    setRipples(r => r.filter(rp => rp.id !== id))
  }

  const RippleLayer = (
    <span className="absolute inset-0 overflow-hidden pointer-events-none rounded-[inherit]">
      {ripples.map(rp => (
        <motion.span
          key={rp.id}
          className="absolute rounded-full"
          style={{
            left: rp.x,
            top: rp.y,
            width: rp.size,
            height: rp.size,
            x: '-50%',
            y: '-50%',
            background: `radial-gradient(circle, ${color} 0%, ${color} 35%, transparent 70%)`,
          }}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          onAnimationComplete={() => remove(rp.id)}
        />
      ))}
    </span>
  )

  return { spawn, RippleLayer, ripples }
}

/**
 * Pressable — accessible clickable surface with press-dip + ember ripple.
 * Renders a real <button> (keyboard-activatable). Use for any "click → go".
 */
export function Pressable({
  children,
  onClick,
  className = '',
  ariaLabel,
  rippleColor,
  scale = 0.97,
  ...rest
}) {
  const reduce = useReducedMotion()
  const { spawn, RippleLayer } = useRipple({ color: rippleColor })

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={spawn}
      onClick={onClick}
      whileTap={reduce ? undefined : { scale }}
      transition={springs.snappy}
      className={`relative overflow-hidden text-left ${className}`}
      {...rest}
    >
      {children}
      {RippleLayer}
    </motion.button>
  )
}

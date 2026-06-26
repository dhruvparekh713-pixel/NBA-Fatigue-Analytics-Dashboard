import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

/**
 * Shared motion vocabulary for the COURTSIDE UI.
 * One place so every reveal / float / hover feels consistent — and so the
 * whole app honors `prefers-reduced-motion` from a single switch.
 */

// Spring transition presets
export const springs = {
  soft: { type: 'spring', stiffness: 90, damping: 18, mass: 0.9 },
  snappy: { type: 'spring', stiffness: 260, damping: 24 },
}

// Stagger container — cascade children into view
export const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
}

// Single item: fade + rise + settle
export const fadeRise = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springs.soft,
  },
}

/**
 * Reveal — fade/rise/settle a block as it scrolls into view (once).
 * Honors reduced-motion (renders immediately, no transform).
 */
export function Reveal({ children, delay = 0, y = 24, className = '', as = 'div', ...rest }) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as] || motion.div

  if (reduce) {
    const Tag = as
    return <Tag className={className} {...rest}>{children}</Tag>
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ ...springs.soft, delay }}
      {...rest}
    >
      {children}
    </MotionTag>
  )
}

/**
 * Stagger — container that cascades its <Item> children into view on scroll.
 */
export function Stagger({ children, className = '', ...rest }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className} {...rest}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/**
 * Item — a single staggered child (use inside <Stagger>). Forwards buoyant
 * hover when `hover` is set.
 */
export function Item({ children, className = '', hover = false, ...rest }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className} {...rest}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={fadeRise}
      {...(hover ? buoyant(reduce) : {})}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/**
 * Float — gentle continuous vertical bob for hero accents (logo, big numbers).
 */
export function Float({ children, className = '', distance = 6, duration = 4, ...rest }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className} {...rest}>{children}</div>
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/**
 * buoyant — shared hover/tap props for interactive cards (spring lift + scale).
 * Pass the reduced-motion flag to no-op it.
 */
export function buoyant(reduce = false) {
  if (reduce) return {}
  return {
    whileHover: { y: -4, scale: 1.015, transition: springs.snappy },
    whileTap: { scale: 0.99 },
  }
}

export { motion, AnimatePresence, useReducedMotion }

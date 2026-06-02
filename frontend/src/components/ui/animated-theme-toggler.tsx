import { useEffect, useRef, useCallback, useState } from "react"
import { flushSync } from "react-dom"

import { Moon, Sun } from "lucide-react"

import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { useShared } from "@/context/SharedContext"

type AnimatedThemeTogglerProps = {
  className?: string
}

export const AnimatedThemeToggler = ({ className }: AnimatedThemeTogglerProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { state, dispatch } = useShared()
  const isDark = state.theme === 'dark'
  const isTransitioning = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // Mark as hydrated on client only
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isTransitioning.current = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const resetTransition = useCallback(() => {
    isTransitioning.current = false
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const performThemeChange = useCallback(() => {
    const nextTheme = isDark ? 'light' : 'dark'
    dispatch({ type: 'SET_THEME', value: nextTheme })
    localStorage.setItem('theme', nextTheme)
    document.body.classList.toggle('dark', nextTheme === 'dark')
  }, [isDark, dispatch])

  const onToggle = useCallback(() => {
    if (!buttonRef.current || isTransitioning.current) return
    
    isTransitioning.current = true

    // Safety timeout to reset transition flag after 1 second
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      resetTransition()
    }, 1000)

    const { left, top, width, height } = buttonRef.current.getBoundingClientRect()
    const centerX = left + width / 2
    const centerY = top + height / 2
    const maxDistance = Math.hypot(
      Math.max(centerX, window.innerWidth - centerX),
      Math.max(centerY, window.innerHeight - centerY)
    )

    // Check if View Transition API is supported
    if (!('startViewTransition' in document)) {
      performThemeChange()
      resetTransition()
      return
    }

    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          performThemeChange()
        })
      })

      transition.ready
        .then(() => {
          const animation = document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${centerX}px ${centerY}px)`,
                `circle(${maxDistance}px at ${centerX}px ${centerY}px)`,
              ],
            },
            {
              duration: 700,
              easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)",
            }
          )

          // Reset flag when animation completes
          animation.onfinish = () => {
            resetTransition()
          }
          
          // Fallback: if animation never finishes, reset after 800ms
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          timeoutRef.current = setTimeout(() => {
            resetTransition()
          }, 800)
        })
        .catch(() => {
          resetTransition()
        })
    } catch (error) {
      performThemeChange()
      resetTransition()
    }
  }, [isDark, performThemeChange, resetTransition])

  return (
    <button
      ref={buttonRef}
      onClick={onToggle}
      aria-label="Switch theme"
      suppressHydrationWarning
      className={cn(
        "flex items-center justify-center p-2 rounded-full outline-none focus:outline-none active:outline-none focus:ring-0 cursor-pointer",
        className
      )}
      type="button"
    >
      <div suppressHydrationWarning>
        {isHydrated ? (
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.span
                key="sun-icon"
                initial={{ opacity: 0, scale: 0.55, rotate: 25 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.33 }}
                className="text-white"
              >
                <Sun />
              </motion.span>
            ) : (
              <motion.span
                key="moon-icon"
                initial={{ opacity: 0, scale: 0.55, rotate: -25 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.33 }}
                className="text-black"
              >
                <Moon />
              </motion.span>
            )}
          </AnimatePresence>
        ) : (
          // Server-side placeholder - will be replaced on client
          <Moon style={{ opacity: 0 }} />
        )}
      </div>
    </button>
  )
}

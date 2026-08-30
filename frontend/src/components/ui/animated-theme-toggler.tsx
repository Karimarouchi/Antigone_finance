import { useEffect, useRef, useCallback, useState, type MouseEvent } from "react"
import { flushSync } from "react-dom"

import { Moon, Sun } from "lucide-react"

import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { useShared } from "@/context/SharedContext"

type AnimatedThemeTogglerProps = {
  className?: string
}

function applyDarkClass(dark: boolean) {
  document.body.classList.toggle("dark", dark)
  document.documentElement.classList.toggle("dark", dark)
}

function revealOrigin(el: HTMLElement) {
  const { left, top, width, height } = el.getBoundingClientRect()
  const x = left + width / 2
  const y = top + height / 2
  const r = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )
  return { x, y, r }
}

export const AnimatedThemeToggler = ({ className }: AnimatedThemeTogglerProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { state, dispatch } = useShared()
  const isDark = state.theme === "dark"
  const isTransitioning = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

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
    const nextTheme = isDark ? "light" : "dark"
    dispatch({ type: "SET_THEME", value: nextTheme })
    localStorage.setItem("theme", nextTheme)
    applyDarkClass(nextTheme === "dark")
  }, [isDark, dispatch])

  const onToggle = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const btn = event.currentTarget
    if (!btn || isTransitioning.current) return

    isTransitioning.current = true
    const { x, y, r } = revealOrigin(btn)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      resetTransition()
    }, 1000)

    if (!("startViewTransition" in document)) {
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
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${r}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 700,
              easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)",
            }
          )
        })
        .catch(() => {})

      transition.finished.finally(() => {
        resetTransition()
      })
    } catch {
      performThemeChange()
      resetTransition()
    }
  }, [performThemeChange, resetTransition])

  return (
    <button
      ref={buttonRef}
      onClick={onToggle}
      aria-label="Switch theme"
      suppressHydrationWarning
      className={cn(
        "theme-toggle-btn flex items-center justify-center p-2 rounded-full outline-none focus:outline-none active:outline-none focus:ring-0 cursor-pointer",
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
          <Moon style={{ opacity: 0 }} />
        )}
      </div>
    </button>
  )
}

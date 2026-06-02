import React, {
  useRef, useEffect, useState, createElement,
  useMemo, useCallback, memo,
} from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export enum Tag { H1 = 'h1', H2 = 'h2', H3 = 'h3', P = 'p' }

type VaporizeTextCycleProps = {
  texts:      string[]
  font?: { fontFamily?: string; fontSize?: string; fontWeight?: number }
  color?:     string
  spread?:    number
  density?:   number
  animation?: { vaporizeDuration?: number; fadeInDuration?: number; waitDuration?: number }
  direction?: 'left-to-right' | 'right-to-left'
  alignment?: 'left' | 'center' | 'right'
  tag?:       Tag
}

type Particle = {
  x: number; y: number
  originalX: number; originalY: number
  color: string
  opacity: number; originalAlpha: number
  velocityX: number; velocityY: number
  angle: number; speed: number
  shouldFadeQuickly?: boolean
}

type TextBoundaries = { left: number; right: number; width: number }

declare global {
  interface HTMLCanvasElement { textBoundaries?: TextBoundaries }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

function transformValue(input: number, inputRange: number[], outputRange: number[], clampVal = false): number {
  const progress = (input - inputRange[0]) / (inputRange[1] - inputRange[0])
  let result = outputRange[0] + progress * (outputRange[1] - outputRange[0])
  if (clampVal) result = outputRange[1] > outputRange[0]
    ? Math.min(Math.max(result, outputRange[0]), outputRange[1])
    : Math.min(Math.max(result, outputRange[1]), outputRange[0])
  return result
}

const parseColor = (color: string) => {
  const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${rgba[4]})`
  const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 1)`
  return 'rgba(232, 98, 26, 1)'
}

const calculateVaporizeSpread = (fontSize: number) => {
  const points = [{ size: 20, spread: 0.2 }, { size: 50, spread: 0.5 }, { size: 100, spread: 1.5 }]
  if (fontSize <= points[0].size) return points[0].spread
  if (fontSize >= points[2].size) return points[2].spread
  let i = 0
  while (i < points.length - 1 && points[i + 1].size < fontSize) i++
  return points[i].spread + (fontSize - points[i].size) * (points[i + 1].spread - points[i].spread) / (points[i + 1].size - points[i].size)
}

const resetParticles = (particles: Particle[]) => {
  particles.forEach(p => {
    p.x = p.originalX; p.y = p.originalY
    p.opacity = p.originalAlpha; p.speed = 0
    p.velocityX = 0; p.velocityY = 0
  })
}

const renderParticles = (ctx: CanvasRenderingContext2D, particles: Particle[], globalDpr: number) => {
  ctx.save(); ctx.scale(globalDpr, globalDpr)
  particles.forEach(p => {
    if (p.opacity > 0) {
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity})`)
      ctx.fillRect(p.x / globalDpr, p.y / globalDpr, 1, 1)
    }
  })
  ctx.restore()
}

const updateParticles = (
  particles: Particle[], vaporizeX: number, deltaTime: number,
  MULTIPLIED_VAPORIZE_SPREAD: number, VAPORIZE_DURATION: number,
  direction: string, density: number,
) => {
  let allVaporized = true
  particles.forEach(p => {
    const shouldVaporize = direction === 'left-to-right' ? p.originalX <= vaporizeX : p.originalX >= vaporizeX
    if (shouldVaporize) {
      if (p.speed === 0) {
        p.angle = Math.random() * Math.PI * 2
        p.speed = (Math.random() * 1 + 0.5) * MULTIPLIED_VAPORIZE_SPREAD
        p.velocityX = Math.cos(p.angle) * p.speed
        p.velocityY = Math.sin(p.angle) * p.speed
        p.shouldFadeQuickly = Math.random() > density
      }
      if (p.shouldFadeQuickly) {
        p.opacity = Math.max(0, p.opacity - deltaTime)
      } else {
        const dx = p.originalX - p.x, dy = p.originalY - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const damp = Math.max(0.95, 1 - dist / (100 * MULTIPLIED_VAPORIZE_SPREAD))
        const sp = MULTIPLIED_VAPORIZE_SPREAD * 3
        p.velocityX = (p.velocityX + (Math.random() - 0.5) * sp + dx * 0.002) * damp
        p.velocityY = (p.velocityY + (Math.random() - 0.5) * sp + dy * 0.002) * damp
        const maxV = MULTIPLIED_VAPORIZE_SPREAD * 2
        const cv = Math.sqrt(p.velocityX ** 2 + p.velocityY ** 2)
        if (cv > maxV) { p.velocityX *= maxV / cv; p.velocityY *= maxV / cv }
        p.x += p.velocityX * deltaTime * 20
        p.y += p.velocityY * deltaTime * 10
        p.opacity = Math.max(0, p.opacity - deltaTime * 0.25 * (2000 / VAPORIZE_DURATION))
      }
      if (p.opacity > 0.01) allVaporized = false
    } else {
      allVaporized = false
    }
  })
  return allVaporized
}

const createParticles = (
  ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement,
  text: string, textX: number, textY: number,
  font: string, color: string, alignment: 'left' | 'center' | 'right',
) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = color; ctx.font = font
  ctx.textAlign = alignment; ctx.textBaseline = 'middle'
  ctx.imageSmoothingQuality = 'high'; ctx.imageSmoothingEnabled = true
  if ('fontKerning'    in ctx) (ctx as unknown as Record<string, string>).fontKerning    = 'normal'
  if ('textRendering'  in ctx) (ctx as unknown as Record<string, string>).textRendering  = 'geometricPrecision'

  const metrics   = ctx.measureText(text)
  const textWidth = metrics.width
  const textLeft  = alignment === 'center' ? textX - textWidth / 2 : alignment === 'left' ? textX : textX - textWidth
  const textBoundaries: TextBoundaries = { left: textLeft, right: textLeft + textWidth, width: textWidth }

  ctx.fillText(text, textX, textY)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data      = imageData.data
  const currentDPR   = canvas.width / parseInt(canvas.style.width)
  const sampleRate = Math.max(1, Math.round(Math.max(1, Math.round(currentDPR / 3))))
  const particles: Particle[] = []

  for (let y = 0; y < canvas.height; y += sampleRate) {
    for (let x = 0; x < canvas.width; x += sampleRate) {
      const idx   = (y * canvas.width + x) * 4
      const alpha = data[idx + 3]
      if (alpha > 0) {
        const originalAlpha = alpha / 255 * (sampleRate / currentDPR)
        particles.push({
          x, y, originalX: x, originalY: y,
          color: `rgba(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]}, ${originalAlpha})`,
          opacity: originalAlpha, originalAlpha,
          velocityX: 0, velocityY: 0, angle: 0, speed: 0,
        })
      }
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  return { particles, textBoundaries }
}

const renderCanvas = ({
  framerProps, canvasRef, wrapperSize, particlesRef, globalDpr, currentTextIndex, transformedDensity,
}: {
  framerProps: VaporizeTextCycleProps
  canvasRef: React.RefObject<HTMLCanvasElement>
  wrapperSize: { width: number; height: number }
  particlesRef: React.MutableRefObject<Particle[]>
  globalDpr: number; currentTextIndex: number; transformedDensity: number
}) => {
  const canvas = canvasRef.current
  if (!canvas || !wrapperSize.width || !wrapperSize.height) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height } = wrapperSize
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`
  canvas.width  = Math.floor(width  * globalDpr)
  canvas.height = Math.floor(height * globalDpr)

  const fontSize = parseInt(framerProps.font?.fontSize?.replace('px', '') || '50')
  const font     = `${framerProps.font?.fontWeight ?? 400} ${fontSize * globalDpr}px ${framerProps.font?.fontFamily ?? 'sans-serif'}`
  const color    = parseColor(framerProps.color ?? 'rgba(232,98,26,1)')
  const align    = framerProps.alignment ?? 'center'
  const textX    = align === 'center' ? canvas.width / 2 : align === 'left' ? 0 : canvas.width
  const textY    = canvas.height / 2
  const text     = framerProps.texts[currentTextIndex] || framerProps.texts[0]

  const { particles, textBoundaries } = createParticles(ctx, canvas, text, textX, textY, font, color, align)
  particlesRef.current     = particles
  canvas.textBoundaries    = textBoundaries
}

function useIsInView(ref: React.RefObject<HTMLElement>) {
  const [isInView, setIsInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { threshold: 0, rootMargin: '50px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return isInView
}

const SeoElement = memo(({ tag = Tag.P, texts }: { tag: Tag; texts: string[] }) => {
  const style = { position: 'absolute' as const, width: '0', height: '0', overflow: 'hidden', userSelect: 'none' as const, pointerEvents: 'none' as const }
  return createElement(Object.values(Tag).includes(tag) ? tag : 'p', { style }, texts.join(' '))
})
SeoElement.displayName = 'SeoElement'

// ── Main component ─────────────────────────────────────────────────────────────

export default function VaporizeTextCycle({
  texts = ['Antigone Pay'],
  font  = { fontFamily: 'sans-serif', fontSize: '80px', fontWeight: 700 },
  color = 'rgb(232, 98, 26)',
  spread    = 5,
  density   = 5,
  animation = { vaporizeDuration: 2, fadeInDuration: 1, waitDuration: 0.5 },
  direction = 'left-to-right',
  alignment = 'center',
  tag       = Tag.H1,
}: VaporizeTextCycleProps) {
  const canvasRef  = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isInView   = useIsInView(wrapperRef as React.RefObject<HTMLElement>)

  const particlesRef       = useRef<Particle[]>([])
  const vaporizeProgressRef = useRef(0)
  const fadeOpacityRef      = useRef(0)
  const dragRef             = useRef<null>(null)

  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [animationState,   setAnimationState]   = useState<'static' | 'vaporizing' | 'fadingIn' | 'waiting'>('static')
  const [wrapperSize,      setWrapperSize]       = useState({ width: 0, height: 0 })

  const globalDpr           = useMemo(() => (typeof window !== 'undefined' ? window.devicePixelRatio * 1.5 : 1), [])
  const transformedDensity  = useMemo(() => transformValue(density, [0, 10], [0.3, 1], true), [density])

  const animationDurations = useMemo(() => ({
    VAPORIZE_DURATION: (animation.vaporizeDuration ?? 2)  * 1000,
    FADE_IN_DURATION:  (animation.fadeInDuration  ?? 1)   * 1000,
    WAIT_DURATION:     (animation.waitDuration    ?? 0.5) * 1000,
  }), [animation.vaporizeDuration, animation.fadeInDuration, animation.waitDuration])

  const fontConfig = useMemo(() => {
    const fontSize             = parseInt(font.fontSize?.replace('px', '') || '50')
    const VAPORIZE_SPREAD      = calculateVaporizeSpread(fontSize)
    const MULTIPLIED_VAPORIZE_SPREAD = VAPORIZE_SPREAD * spread
    return { fontSize, MULTIPLIED_VAPORIZE_SPREAD, font: `${font.fontWeight ?? 400} ${fontSize * globalDpr}px ${font.fontFamily}` }
  }, [font.fontSize, font.fontWeight, font.fontFamily, spread, globalDpr])

  const memoizedUpdateParticles = useCallback((particles: Particle[], vaporizeX: number, deltaTime: number) =>
    updateParticles(particles, vaporizeX, deltaTime, fontConfig.MULTIPLIED_VAPORIZE_SPREAD, animationDurations.VAPORIZE_DURATION, direction, transformedDensity),
  [fontConfig.MULTIPLIED_VAPORIZE_SPREAD, animationDurations.VAPORIZE_DURATION, direction, transformedDensity])

  const memoizedRenderParticles = useCallback((ctx: CanvasRenderingContext2D, particles: Particle[]) =>
    renderParticles(ctx, particles, globalDpr), [globalDpr])

  useEffect(() => {
    if (isInView) { setTimeout(() => setAnimationState('vaporizing'), 0) }
    else          { setAnimationState('static') }
  }, [isInView])

  useEffect(() => {
    if (!isInView) return
    let lastTime = performance.now()
    let frameId: number

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000
      lastTime = currentTime
      const canvas = canvasRef.current
      const ctx    = canvas?.getContext('2d')
      if (!canvas || !ctx || !particlesRef.current.length) { frameId = requestAnimationFrame(animate); return }
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (animationState === 'static' || animationState === 'waiting') {
        memoizedRenderParticles(ctx, particlesRef.current)
      } else if (animationState === 'vaporizing') {
        vaporizeProgressRef.current += deltaTime * 100 / (animationDurations.VAPORIZE_DURATION / 1000)
        const tb = canvas.textBoundaries
        if (tb) {
          const progress   = Math.min(100, vaporizeProgressRef.current)
          const vaporizeX  = direction === 'left-to-right'
            ? tb.left + tb.width * progress / 100
            : tb.right - tb.width * progress / 100
          const allVaporized = memoizedUpdateParticles(particlesRef.current, vaporizeX, deltaTime)
          memoizedRenderParticles(ctx, particlesRef.current)
          if (vaporizeProgressRef.current >= 100 && allVaporized) {
            setCurrentTextIndex(prev => (prev + 1) % texts.length)
            setAnimationState('fadingIn')
            fadeOpacityRef.current = 0
          }
        }
      } else if (animationState === 'fadingIn') {
        fadeOpacityRef.current += deltaTime * 1000 / animationDurations.FADE_IN_DURATION
        ctx.save(); ctx.scale(globalDpr, globalDpr)
        particlesRef.current.forEach(p => {
          p.x = p.originalX; p.y = p.originalY
          const opacity = Math.min(fadeOpacityRef.current, 1) * p.originalAlpha
          ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${opacity})`)
          ctx.fillRect(p.x / globalDpr, p.y / globalDpr, 1, 1)
        })
        ctx.restore()
        if (fadeOpacityRef.current >= 1) {
          setAnimationState('waiting')
          setTimeout(() => { setAnimationState('vaporizing'); vaporizeProgressRef.current = 0; resetParticles(particlesRef.current) }, animationDurations.WAIT_DURATION)
        }
      }

      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [animationState, isInView, texts.length, direction, globalDpr, memoizedUpdateParticles, memoizedRenderParticles, animationDurations])

  useEffect(() => {
    renderCanvas({ framerProps: { texts, font, color, alignment }, canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>, wrapperSize, particlesRef, globalDpr, currentTextIndex, transformedDensity })
  }, [texts, font, color, alignment, wrapperSize, currentTextIndex, globalDpr, transformedDensity])

  useEffect(() => {
    const container = wrapperRef.current
    if (!container) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setWrapperSize({ width, height })
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (wrapperRef.current) {
      const { width, height } = wrapperRef.current.getBoundingClientRect()
      setWrapperSize({ width, height })
    }
  }, [])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ minWidth: '30px', minHeight: '20px', pointerEvents: 'none' }} />
      <SeoElement tag={tag} texts={texts} />
    </div>
  )
}

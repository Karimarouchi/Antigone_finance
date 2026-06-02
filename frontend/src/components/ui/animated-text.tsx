import { useEffect, useRef } from "react"

interface AnimatedTextProps {
  text: string
  fontSize?: number
  minWeight?: number
  maxWeight?: number
  animationDuration?: number
  delayMultiplier?: number
  color?: string
}

export function AnimatedText({
  text,
  fontSize = 150,
  minWeight = 100,
  maxWeight = 840,
  animationDuration = 1.5,
  delayMultiplier = 0.25,
  color,
}: AnimatedTextProps) {
  const containerRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const spans = containerRef.current.querySelectorAll("span[data-char]")
    const numLetters = spans.length
    spans.forEach((span, i) => {
      const mappedIndex = i - numLetters / 2;
      (span as HTMLElement).style.animationDelay = mappedIndex * delayMultiplier + "s"
    })
  }, [text, delayMultiplier])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <style>{`
        @keyframes animated-text-breath {
          0%   { font-variation-settings: "wght" ${minWeight}; }
          100% { font-variation-settings: "wght" ${maxWeight}; }
        }
      `}</style>
      <p
        ref={containerRef}
        aria-label={text}
        style={{ fontSize: `${fontSize}px`, margin: 0, fontFeatureSettings: '"wght"', letterSpacing: '-0.02em', color: color ?? 'inherit' }}
      >
        {text.split("").map((char, index) => (
          <span
            key={index}
            data-char
            aria-hidden="true"
            style={{
              animationName: "animated-text-breath",
              animationDuration: `${animationDuration}s`,
              animationDirection: "alternate",
              animationTimingFunction: "cubic-bezier(0.37, 0, 0.63, 1)",
              animationIterationCount: "infinite",
              animationFillMode: "both",
              fontVariationSettings: `"wght" ${minWeight}`,
            }}
          >
            {char}
          </span>
        ))}
      </p>
    </div>
  )
}

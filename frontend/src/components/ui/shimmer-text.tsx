import { motion } from "motion/react";

interface ShimmerTextProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  shimmerColor?: string;
  duration?: number;
  delay?: number;
}

export function ShimmerText({
  children,
  className,
  color = "var(--muted)",
  shimmerColor = "var(--text)",
  duration = 2,
  delay = 1,
  style,
}: ShimmerTextProps) {
  return (
    <div style={{ overflow: "hidden" }}>
      <motion.div
        className={className}
        style={{
          ...style,
          WebkitTextFillColor: "transparent",
          background: `${color} linear-gradient(to right, ${color} 0%, ${shimmerColor} 40%, ${shimmerColor} 60%, ${color} 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          backgroundRepeat: "no-repeat",
          backgroundSize: "50% 200%",
          display: "inline-block",
        } as React.CSSProperties}
        initial={{ backgroundPositionX: "250%" }}
        animate={{ backgroundPositionX: ["-100%", "250%"] }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          repeatDelay: 2,
          ease: "linear",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default ShimmerText;

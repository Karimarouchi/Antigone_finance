// Framer Motion easing constants ported from the source project.
export const EASE_OUT = (t: number): number => 1 - (1 - t) * (1 - t);
export const EASE_OUT_ALT = (t: number): number => 1 - Math.pow(1 - t, 3);
export const EASE_IN_OUT = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

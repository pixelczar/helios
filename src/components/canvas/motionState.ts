// Per-frame state shared between the timeline, its run cards and the
// morphing route. Plain mutable objects (not React state) — written and read
// inside useFrame, so nothing re-renders.

/**
 * routeHide: how much the cards' own route lines step aside for the morph
 * line (0–1). timelineIndex: the timeline's *spring* position in run slots —
 * where the cards visually are, which lags the raw scroll offset.
 */
export const morphState = { routeHide: 0, timelineIndex: 0 };

/**
 * Smoothed pointer tilt in radians, applied to the focused run (and the
 * morph line) so the scene leans gently toward the cursor.
 */
export const parallax = { x: 0, y: 0 };

/** Each card's current rotation, world depth and scale, keyed by timeline index. */
export interface CardPose {
  rx: number;
  ry: number;
  rz: number;
  z: number; // world z (timeline spring + slot + kick)
  scale: number;
}
export const cardPoses = new Map<number, CardPose>();

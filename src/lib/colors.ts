import * as THREE from "three";

// Pace-based colors — matches scroll indicator
const BEHIND_COLOR = new THREE.Color("#ff8844"); // behind pace = warm amber
const AHEAD_COLOR = new THREE.Color("#00ffcc"); // ahead of pace = electric cyan

/**
 * Color a route based on yearly pace ratio.
 * ratio < 1 = behind pace (amber), ratio > 1 = ahead (cyan).
 * Smoothly interpolates around 1.0.
 */
export function getRouteColor(paceRatio: number): THREE.Color {
  // Map ratio to 0-1 blend: 0.8 → 0, 1.0 → 0.5, 1.2 → 1
  const t = Math.max(0, Math.min(1, (paceRatio - 0.8) / 0.4));
  return BEHIND_COLOR.clone().lerp(AHEAD_COLOR, t);
}

export function getRouteColorHex(paceRatio: number): string {
  return `#${getRouteColor(paceRatio).getHexString()}`;
}

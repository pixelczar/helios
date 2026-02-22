import * as THREE from "three";

// Pace-based color: warm amber (easy) → electric cyan (fast)
const SLOW_COLOR = new THREE.Color("#ff8844");
const FAST_COLOR = new THREE.Color("#00ffcc");

export function getRouteColor(
  avgSpeed: number,
  allSpeeds: number[]
): THREE.Color {
  if (allSpeeds.length === 0) return SLOW_COLOR.clone();

  const sorted = [...allSpeeds].sort((a, b) => a - b);
  const minSpeed = sorted[0];
  const maxSpeed = sorted[sorted.length - 1];

  if (maxSpeed === minSpeed) return SLOW_COLOR.clone().lerp(FAST_COLOR, 0.5);

  const t = (avgSpeed - minSpeed) / (maxSpeed - minSpeed);
  return SLOW_COLOR.clone().lerp(FAST_COLOR, t);
}

export function getRouteColorHex(
  avgSpeed: number,
  allSpeeds: number[]
): string {
  return `#${getRouteColor(avgSpeed, allSpeeds).getHexString()}`;
}

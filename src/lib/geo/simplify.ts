function perpendicularDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const [px, py] = point;
  const [sx, sy] = lineStart;
  const [ex, ey] = lineEnd;

  const dx = ex - sx;
  const dy = ey - sy;

  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
  }

  const t = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy);
  const cx = sx + t * dx;
  const cy = sy + t * dy;

  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

export function simplifyRoute(
  points: [number, number][],
  tolerance: number = 0.00005
): [number, number][] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1]
    );
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyRoute(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyRoute(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
}

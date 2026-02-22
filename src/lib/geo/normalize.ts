export function normalizeRoute(
  points: [number, number][],
  targetSize: number = 5
): [number, number][] {
  if (points.length === 0) return [];

  // Find centroid
  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of points) {
    sumLat += lat;
    sumLng += lng;
  }
  const centerLat = sumLat / points.length;
  const centerLng = sumLng / points.length;

  // Apply Mercator correction and center
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const centered = points.map(
    ([lat, lng]) =>
      [(lng - centerLng) * cosLat, lat - centerLat] as [number, number]
  );

  // Find max extent
  let maxExtent = 0;
  for (const [x, y] of centered) {
    maxExtent = Math.max(maxExtent, Math.abs(x), Math.abs(y));
  }

  if (maxExtent === 0) return centered;

  // Scale to fit within targetSize
  const scale = targetSize / (2 * maxExtent);
  return centered.map(([x, y]) => [x * scale, y * scale]);
}

/**
 * Slippy map tile math — converts lat/lng bounding boxes to OSM tile coordinates.
 * Used for fetching CartoDB Dark Matter tiles to overlay behind routes.
 */

export function latLngToTile(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n
  );
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

export function tileToLatLng(
  x: number,
  y: number,
  zoom: number
): { lat: number; lng: number } {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

export interface TileCoverage {
  zoom: number;
  minTileX: number;
  maxTileX: number;
  minTileY: number;
  maxTileY: number;
  // Actual lat/lng bounds of the tile grid (slightly larger than requested bbox)
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export function getTileCoverage(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  zoom: number
): TileCoverage {
  const topLeft = latLngToTile(maxLat, minLng, zoom);
  const bottomRight = latLngToTile(minLat, maxLng, zoom);

  const nw = tileToLatLng(topLeft.x, topLeft.y, zoom);
  const se = tileToLatLng(bottomRight.x + 1, bottomRight.y + 1, zoom);

  return {
    zoom,
    minTileX: topLeft.x,
    maxTileX: bottomRight.x,
    minTileY: topLeft.y,
    maxTileY: bottomRight.y,
    bounds: {
      maxLat: nw.lat,
      minLng: nw.lng,
      minLat: se.lat,
      maxLng: se.lng,
    },
  };
}

export function chooseBestZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  maxTiles: number = 4
): number {
  for (let z = 16; z >= 10; z--) {
    const coverage = getTileCoverage(minLat, maxLat, minLng, maxLng, z);
    const cols = coverage.maxTileX - coverage.minTileX + 1;
    const rows = coverage.maxTileY - coverage.minTileY + 1;
    if (cols * rows <= maxTiles) return z;
  }
  return 10;
}

/**
 * Fetches CartoDB Dark Matter tiles and composites them onto a canvas.
 * Free, no API key required.
 */

import { chooseBestZoom, getTileCoverage, type TileCoverage } from "./tiles";

const TILE_SIZE = 256;
const TILE_URL = "https://basemaps.cartocdn.com/dark_nolabels";

// LRU cache — keyed by activityId
const cache = new Map<number, { canvas: HTMLCanvasElement; coverage: TileCoverage }>();
const CACHE_LIMIT = 200;

function evictOldest() {
  if (cache.size >= CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}

// In-flight dedup — if a fetch is already in progress for an activity, reuse it
const inflight = new Map<number, Promise<{ canvas: HTMLCanvasElement; coverage: TileCoverage } | null>>();

// Tile fetch concurrency limiter — avoid overwhelming the browser/CDN
const MAX_CONCURRENT_TILES = 12;
let activeTileFetches = 0;
const tileQueue: (() => void)[] = [];

function fetchTileImage(z: number, x: number, y: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const doFetch = () => {
      activeTileFetches++;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { activeTileFetches--; drainTileQueue(); resolve(img); };
      img.onerror = () => { activeTileFetches--; drainTileQueue(); reject(new Error("tile load failed")); };
      img.src = `${TILE_URL}/${z}/${x}/${y}@2x.png`;
    };

    if (activeTileFetches < MAX_CONCURRENT_TILES) {
      doFetch();
    } else {
      tileQueue.push(doFetch);
    }
  });
}

function drainTileQueue() {
  while (tileQueue.length > 0 && activeTileFetches < MAX_CONCURRENT_TILES) {
    const next = tileQueue.shift();
    if (next) next();
  }
}

export async function fetchMapImage(
  activityId: number,
  rawPoints: [number, number][]
): Promise<{ canvas: HTMLCanvasElement; coverage: TileCoverage } | null> {
  // Check cache first
  const cached = cache.get(activityId);
  if (cached) return cached;

  // Deduplicate concurrent requests for the same activity
  const existing = inflight.get(activityId);
  if (existing) return existing;

  const promise = _fetchMapImageInner(activityId, rawPoints);
  inflight.set(activityId, promise);
  promise.finally(() => inflight.delete(activityId));
  return promise;
}

async function _fetchMapImageInner(
  activityId: number,
  rawPoints: [number, number][]
): Promise<{ canvas: HTMLCanvasElement; coverage: TileCoverage } | null> {
  if (rawPoints.length < 2) return null;

  // Compute bounding box with 15% padding
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of rawPoints) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  const padLat = (maxLat - minLat) * 0.15 || 0.001;
  const padLng = (maxLng - minLng) * 0.15 || 0.001;
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;

  const zoom = chooseBestZoom(minLat, maxLat, minLng, maxLng, 25);
  const coverage = getTileCoverage(minLat, maxLat, minLng, maxLng, zoom);

  const cols = coverage.maxTileX - coverage.minTileX + 1;
  const rows = coverage.maxTileY - coverage.minTileY + 1;

  // Fetch all tiles in parallel
  const tilePromises: Promise<{ img: HTMLImageElement; col: number; row: number } | null>[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = coverage.minTileX + col;
      const ty = coverage.minTileY + row;
      tilePromises.push(
        fetchTileImage(zoom, tx, ty)
          .then((img) => ({ img, col, row }))
          .catch(() => null)
      );
    }
  }

  const results = await Promise.all(tilePromises);

  // Composite onto canvas with rounded corners
  const canvas = document.createElement("canvas");
  // Use @2x tile size (512px per tile)
  const w = cols * TILE_SIZE * 2;
  const h = rows * TILE_SIZE * 2;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Clip to rounded rectangle before drawing tiles
  const cornerRadius = Math.min(w, h) * 0.06;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, cornerRadius);
  ctx.clip();

  for (const result of results) {
    if (!result) continue;
    ctx.drawImage(
      result.img,
      result.col * TILE_SIZE * 2,
      result.row * TILE_SIZE * 2,
      TILE_SIZE * 2,
      TILE_SIZE * 2
    );
  }

  // Soft vignette — erase edges to transparent (avoids banding from
  // darkening near-black tiles with multiply)
  const edgeGrad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.6
  );
  edgeGrad.addColorStop(0, "rgba(0,0,0,0)");
  edgeGrad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  const entry = { canvas, coverage };

  // Cache with LRU eviction
  evictOldest();
  cache.set(activityId, entry);

  return entry;
}

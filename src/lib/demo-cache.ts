import fs from "fs";
import path from "path";
import { STRAVA_API_BASE } from "@/lib/strava/constants";
import type { StravaActivity, ActivityPhoto } from "@/lib/strava/types";
import seedData from "@/data/demo-activities.json";

const CACHE_PATH = path.join(process.cwd(), ".demo-cache.json");
const PHOTOS_CACHE_PATH = path.join(process.cwd(), ".demo-photos-cache.json");

/**
 * Reads demo activities from the disk cache, falling back to the bundled seed file.
 */
export function readDemoCache(): StravaActivity[] {
  // Try the live cache first
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    }
  } catch {
    // fall through to bundled fallback
  }

  return seedData as StravaActivity[];
}

/**
 * Reads cached photo arrays for a given activity, returning [] if not found.
 */
export function readDemoPhotosCache(activityId: number): ActivityPhoto[] {
  try {
    if (fs.existsSync(PHOTOS_CACHE_PATH)) {
      const map: Record<string, ActivityPhoto[]> = JSON.parse(
        fs.readFileSync(PHOTOS_CACHE_PATH, "utf8")
      );
      return map[activityId] ?? [];
    }
  } catch {
    // fall through
  }
  return [];
}

/**
 * Fetches all runs from Strava using the given access token and writes them
 * to the demo cache file on disk. Also fetches and caches photo URLs for
 * activities that have photos. Intended to be called fire-and-forget.
 */
export async function syncDemoCache(accessToken: string): Promise<void> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    let allRuns: StravaActivity[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(
        `${STRAVA_API_BASE}/athlete/activities?page=${page}&per_page=200`,
        { headers }
      );

      if (!res.ok) break;

      const activities: StravaActivity[] = await res.json();
      const runs = activities.filter((a) => a.type === "Run");
      allRuns = [...allRuns, ...runs];

      hasMore = activities.length === 200;
      page++;
    }

    if (allRuns.length > 0) {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(allRuns));
    }

    // Fetch and cache photo URLs for activities that have photos
    const runsWithPhotos = allRuns.filter((a) => a.total_photo_count > 0);
    if (runsWithPhotos.length === 0) return;

    const photosMap: Record<string, ActivityPhoto[]> = {};
    const CONCURRENCY = 5;

    for (let i = 0; i < runsWithPhotos.length; i += CONCURRENCY) {
      const batch = runsWithPhotos.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (run) => {
          try {
            const res = await fetch(
              `${STRAVA_API_BASE}/activities/${run.id}/photos?size=600`,
              { headers }
            );
            if (res.ok) {
              photosMap[run.id] = await res.json();
            }
          } catch {
            // skip this activity's photos
          }
        })
      );
    }

    fs.writeFileSync(PHOTOS_CACHE_PATH, JSON.stringify(photosMap));
  } catch (err) {
    console.error("Failed to sync demo cache:", err);
  }
}

import fs from "fs";
import path from "path";
import { STRAVA_API_BASE } from "@/lib/strava/constants";
import type { StravaActivity } from "@/lib/strava/types";

const CACHE_PATH = path.join(process.cwd(), ".demo-cache.json");
const FALLBACK_PATH = path.join(process.cwd(), "src/data/demo-activities.json");

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

  // Bundled seed data (committed to repo)
  try {
    if (fs.existsSync(FALLBACK_PATH)) {
      return JSON.parse(fs.readFileSync(FALLBACK_PATH, "utf8"));
    }
  } catch {
    // no fallback available
  }

  return [];
}

/**
 * Fetches all runs from Strava using the given access token and writes them
 * to the demo cache file on disk. Intended to be called fire-and-forget.
 */
export async function syncDemoCache(accessToken: string): Promise<void> {
  try {
    let allRuns: StravaActivity[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(
        `${STRAVA_API_BASE}/athlete/activities?page=${page}&per_page=200`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
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
  } catch (err) {
    console.error("Failed to sync demo cache:", err);
  }
}

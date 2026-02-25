#!/usr/bin/env node
/**
 * Populates .demo-photos-cache.json with real Strava photo URLs.
 *
 * Usage:
 *   node scripts/sync-demo-photos.mjs <strava_access_token>
 *
 * Get your token from browser cookies (strava_access_token) while logged in.
 */
import fs from "fs";
import path from "path";

const STRAVA_API = "https://www.strava.com/api/v3";
const CACHE_PATH = path.join(process.cwd(), ".demo-cache.json");
const PHOTOS_PATH = path.join(process.cwd(), ".demo-photos-cache.json");

const token = process.argv[2];
if (!token) {
  console.error("Usage: node scripts/sync-demo-photos.mjs <strava_access_token>");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}` };
const thisYear = new Date().getFullYear();

// Read cached activities
if (!fs.existsSync(CACHE_PATH)) {
  console.error("No .demo-cache.json found — log in with Strava first to populate it.");
  process.exit(1);
}

const activities = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
const withPhotos = activities.filter(
  (a) => a.total_photo_count > 0 && new Date(a.start_date).getFullYear() === thisYear
);

console.log(`Found ${withPhotos.length} activities with photos from ${thisYear}`);

const photosMap = {};
let fetched = 0;

for (const run of withPhotos) {
  const res = await fetch(`${STRAVA_API}/activities/${run.id}/photos?size=600`, { headers });

  if (res.status === 429) {
    console.error(`Rate limited after ${fetched} fetches. Saving what we have.`);
    break;
  }

  if (res.ok) {
    photosMap[run.id] = await res.json();
    fetched++;
    console.log(`  [${fetched}/${withPhotos.length}] ${run.name} — ${photosMap[run.id].length} photos`);
  } else {
    console.warn(`  SKIP ${run.name} — ${res.status}`);
  }

  // 2s delay between requests
  await new Promise((r) => setTimeout(r, 2000));
}

fs.writeFileSync(PHOTOS_PATH, JSON.stringify(photosMap));
console.log(`\nDone — ${fetched} activities cached to .demo-photos-cache.json`);

#!/usr/bin/env node
/**
 * Populates src/data/demo-photos.json with real Strava photo URLs for demo mode.
 *
 * Usage:
 *   # With an access token (from browser cookies):
 *   node scripts/sync-demo-photos.mjs <access_token>
 *
 *   # With a refresh token (auto-refreshes using .env.local creds):
 *   node scripts/sync-demo-photos.mjs --refresh <refresh_token>
 */
import fs from "fs";
import path from "path";

const STRAVA_API = "https://www.strava.com/api/v3";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const CACHE_PATH = path.join(process.cwd(), ".demo-cache.json");
const SEED_PATH = path.join(process.cwd(), "src/data/demo-activities.json");
const OUTPUT_PATH = path.join(process.cwd(), "src/data/demo-photos.json");

// ---------------------------------------------------------------------------
// Read .env.local for client creds
// ---------------------------------------------------------------------------
function readEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

// ---------------------------------------------------------------------------
// Resolve access token
// ---------------------------------------------------------------------------
async function resolveToken() {
  if (process.argv[2] === "--refresh") {
    const refreshToken = process.argv[3];
    if (!refreshToken) {
      console.error("Usage: node scripts/sync-demo-photos.mjs --refresh <refresh_token>");
      process.exit(1);
    }
    const env = readEnv();
    const clientId = env.STRAVA_CLIENT_ID;
    const clientSecret = env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in .env.local");
      process.exit(1);
    }
    console.log("Refreshing access token...");
    const res = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      console.error("Token refresh failed:", res.status, await res.text());
      process.exit(1);
    }
    const tokens = await res.json();
    console.log("Token refreshed successfully.\n");
    return tokens.access_token;
  }

  const token = process.argv[2];
  if (!token) {
    console.error(
      "Usage:\n" +
        "  node scripts/sync-demo-photos.mjs <access_token>\n" +
        "  node scripts/sync-demo-photos.mjs --refresh <refresh_token>"
    );
    process.exit(1);
  }
  return token;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const token = await resolveToken();
const headers = { Authorization: `Bearer ${token}` };

// Read cached activities (prefer live cache, fall back to bundled seed)
let activitiesPath = CACHE_PATH;
if (!fs.existsSync(CACHE_PATH)) {
  if (!fs.existsSync(SEED_PATH)) {
    console.error("No activity data found. Log in with Strava first to populate .demo-cache.json");
    process.exit(1);
  }
  activitiesPath = SEED_PATH;
  console.log("Using bundled seed data (no .demo-cache.json found).\n");
}

const activities = JSON.parse(fs.readFileSync(activitiesPath, "utf8"));
const withPhotos = activities.filter((a) => a.total_photo_count > 0);

console.log(`Found ${withPhotos.length} activities with photos (out of ${activities.length} total)`);

// Load existing progress if any (so we can resume after rate limits)
let photosMap = {};
if (fs.existsSync(OUTPUT_PATH)) {
  try {
    photosMap = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
    const existing = Object.keys(photosMap).length;
    console.log(`Resuming — ${existing} activities already cached, fetching the rest.\n`);
  } catch {
    photosMap = {};
  }
}

let fetched = 0;
let skipped = 0;

for (const run of withPhotos) {
  // Skip if already cached
  if (photosMap[run.id]) {
    skipped++;
    continue;
  }

  const res = await fetch(`${STRAVA_API}/activities/${run.id}/photos?size=600`, { headers });

  if (res.status === 429) {
    console.error(`\nRate limited after ${fetched} new fetches. Saving progress — re-run to continue.`);
    break;
  }

  if (res.ok) {
    photosMap[run.id] = await res.json();
    fetched++;
    const total = skipped + fetched;
    console.log(`  [${total}/${withPhotos.length}] ${run.name} — ${photosMap[run.id].length} photos`);
  } else {
    console.warn(`  SKIP ${run.name} — ${res.status}`);
  }

  // 2s delay between requests to respect Strava rate limits (100 req/15min)
  await new Promise((r) => setTimeout(r, 2000));
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(photosMap));
const totalCached = Object.keys(photosMap).length;
console.log(`\nDone — ${totalCached} activities with photos saved to src/data/demo-photos.json`);

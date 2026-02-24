import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { stravaFetch } from "@/lib/strava/client";
import { readDemoCache } from "@/lib/demo-cache";
import type { ActivityPhoto } from "@/lib/strava/types";

const PHOTOS_CACHE_PATH = path.join(process.cwd(), ".demo-photos-cache.json");
const CONCURRENCY = 5;

export async function GET() {
  const runs = readDemoCache();
  const runsWithPhotos = runs.filter((a) => a.total_photo_count > 0);

  const photosMap: Record<string, ActivityPhoto[]> = {};
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < runsWithPhotos.length; i += CONCURRENCY) {
    const batch = runsWithPhotos.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (run) => {
        try {
          const res = await stravaFetch(
            `/activities/${run.id}/photos?size=600`
          );
          if (res.ok) {
            photosMap[run.id] = await res.json();
            fetched++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      })
    );
  }

  fs.writeFileSync(PHOTOS_CACHE_PATH, JSON.stringify(photosMap));

  return NextResponse.json({
    ok: true,
    activitiesWithPhotos: runsWithPhotos.length,
    fetched,
    failed,
    cachedAt: PHOTOS_CACHE_PATH,
  });
}

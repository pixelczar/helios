import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { stravaFetch } from "@/lib/strava/client";
import { readDemoCache } from "@/lib/demo-cache";
import type { ActivityPhoto } from "@/lib/strava/types";

const PHOTOS_CACHE_PATH = path.join(process.cwd(), ".demo-photos-cache.json");

export async function GET() {
  const runs = readDemoCache();
  const thisYear = new Date().getFullYear();
  const runsWithPhotos = runs.filter(
    (a) =>
      a.total_photo_count > 0 &&
      new Date(a.start_date).getFullYear() === thisYear
  );

  const photosMap: Record<string, ActivityPhoto[]> = {};
  let fetched = 0;
  let failed = 0;

  for (const run of runsWithPhotos) {
    try {
      const res = await stravaFetch(`/activities/${run.id}/photos?size=600`);
      if (res.status === 429) {
        // Save whatever we have so far, then bail with a clear error
        fs.writeFileSync(PHOTOS_CACHE_PATH, JSON.stringify(photosMap));
        return NextResponse.json(
          { ok: false, error: "Rate limited by Strava — wait a few minutes and try again", fetched, failed },
          { status: 429 }
        );
      }
      if (res.ok) {
        photosMap[run.id] = await res.json();
        fetched++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  fs.writeFileSync(PHOTOS_CACHE_PATH, JSON.stringify(photosMap));

  return NextResponse.json({
    ok: true,
    activitiesWithPhotos: runsWithPhotos.length,
    fetched,
    failed,
  });
}

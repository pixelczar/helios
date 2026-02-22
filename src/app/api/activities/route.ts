import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stravaFetch } from "@/lib/strava/client";
import { readDemoCache } from "@/lib/demo-cache";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  // Demo mode — serve cached data instead of hitting Strava
  if (cookieStore.has("demo_mode")) {
    const after = request.nextUrl.searchParams.get("after");
    let runs = readDemoCache();

    if (after) {
      const afterEpoch = Number(after);
      runs = runs.filter(
        (a) => new Date(a.start_date).getTime() / 1000 > afterEpoch
      );
    }

    return NextResponse.json(runs);
  }

  const page = request.nextUrl.searchParams.get("page") || "1";
  const perPage = request.nextUrl.searchParams.get("per_page") || "50";
  const after = request.nextUrl.searchParams.get("after"); // epoch seconds

  try {
    let url = `/athlete/activities?page=${page}&per_page=${perPage}`;
    if (after) {
      url += `&after=${after}`;
    }

    const res = await stravaFetch(url);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch activities" },
        { status: res.status }
      );
    }

    const activities = await res.json();

    // Filter to runs only
    const runs = activities.filter(
      (a: { type: string }) => a.type === "Run"
    );

    return NextResponse.json(runs);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}

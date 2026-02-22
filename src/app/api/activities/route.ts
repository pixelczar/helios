import { NextRequest, NextResponse } from "next/server";
import { stravaFetch } from "@/lib/strava/client";

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") || "1";
  const perPage = request.nextUrl.searchParams.get("per_page") || "50";

  try {
    const res = await stravaFetch(
      `/athlete/activities?page=${page}&per_page=${perPage}`
    );

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

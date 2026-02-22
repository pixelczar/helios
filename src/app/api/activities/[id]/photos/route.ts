import { NextRequest, NextResponse } from "next/server";
import { stravaFetch } from "@/lib/strava/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const res = await stravaFetch(`/activities/${id}/photos?size=600`);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch photos" },
        { status: res.status }
      );
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { stravaFetch } from "@/lib/strava/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const res = await stravaFetch(
      `/activities/${id}/streams?keys=latlng,altitude,time,distance&key_by_type=true`
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch streams" },
        { status: res.status }
      );
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}

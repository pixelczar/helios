import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stravaFetch } from "@/lib/strava/client";
import { readDemoPhotosCache } from "@/lib/demo-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const size = request.nextUrl.searchParams.get("size") || "600";

  const cookieStore = await cookies();
  if (cookieStore.has("demo_mode")) {
    return NextResponse.json(readDemoPhotosCache(Number(id)));
  }

  try {
    const res = await stravaFetch(`/activities/${id}/photos?size=${size}`);

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

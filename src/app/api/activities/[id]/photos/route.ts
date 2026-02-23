import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stravaFetch } from "@/lib/strava/client";
import { readDemoCache } from "@/lib/demo-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const size = request.nextUrl.searchParams.get("size") || "600";

  const cookieStore = await cookies();
  if (cookieStore.has("demo_mode")) {
    const activity = readDemoCache().find((a) => a.id === Number(id));
    const count = activity?.total_photo_count ?? 0;
    const photos = Array.from({ length: count }, (_, i) => ({
      unique_id: `demo-${id}-${i}`,
      urls: { [size]: `https://picsum.photos/seed/${id}-${i}/${size}/${size}` },
      caption: "",
      source: 2,
    }));
    return NextResponse.json(photos);
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

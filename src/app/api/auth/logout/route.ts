import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  cookieStore.delete("strava_access_token");
  cookieStore.delete("strava_refresh_token");
  cookieStore.delete("strava_token_expires_at");
  cookieStore.delete("strava_athlete");

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/`
  );
}

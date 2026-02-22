import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  cookieStore.delete("strava_access_token");
  cookieStore.delete("strava_refresh_token");
  cookieStore.delete("strava_token_expires_at");
  cookieStore.delete("strava_athlete");
  cookieStore.delete("demo_mode");

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAVA_TOKEN_URL } from "@/lib/strava/constants";
import { syncDemoCache } from "@/lib/demo-cache";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/";
    errorUrl.search = "?error=no_code";
    return NextResponse.redirect(errorUrl);
  }

  const tokenRes = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/";
    errorUrl.search = "?error=token_exchange_failed";
    return NextResponse.redirect(errorUrl);
  }

  const tokens = await tokenRes.json();
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  };

  cookieStore.set("strava_access_token", tokens.access_token, cookieOptions);
  cookieStore.set("strava_refresh_token", tokens.refresh_token, cookieOptions);
  cookieStore.set(
    "strava_token_expires_at",
    String(tokens.expires_at),
    cookieOptions
  );
  cookieStore.set(
    "strava_athlete",
    JSON.stringify({
      id: tokens.athlete?.id,
      firstname: tokens.athlete?.firstname,
    }),
    { ...cookieOptions, httpOnly: false }
  );

  // Refresh the demo cache in the background so demo users see fresh data
  syncDemoCache(tokens.access_token).catch(() => {});

  const appUrl = request.nextUrl.clone();
  appUrl.pathname = "/app";
  appUrl.search = "";
  return NextResponse.redirect(appUrl);
}

import { NextRequest, NextResponse } from "next/server";
import { STRAVA_AUTH_URL, STRAVA_SCOPES } from "@/lib/strava/constants";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: STRAVA_SCOPES,
    approval_prompt: "auto",
  });

  return NextResponse.redirect(`${STRAVA_AUTH_URL}?${params.toString()}`);
}

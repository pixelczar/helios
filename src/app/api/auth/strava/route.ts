import { NextResponse } from "next/server";
import { STRAVA_AUTH_URL, STRAVA_SCOPES } from "@/lib/strava/constants";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`,
    response_type: "code",
    scope: STRAVA_SCOPES,
    approval_prompt: "auto",
  });

  return NextResponse.redirect(`${STRAVA_AUTH_URL}?${params.toString()}`);
}

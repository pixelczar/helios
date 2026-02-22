import { cookies } from "next/headers";
import { STRAVA_TOKEN_URL, STRAVA_API_BASE } from "./constants";

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh token");
  return res.json();
}

export async function stravaFetch(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("strava_access_token")?.value;
  const refreshToken = cookieStore.get("strava_refresh_token")?.value;
  const expiresAt = cookieStore.get("strava_token_expires_at")?.value;

  if (!accessToken || !refreshToken) {
    throw new Error("Not authenticated");
  }

  // Refresh if expired or expiring within 60 seconds
  if (expiresAt && Date.now() / 1000 > Number(expiresAt) - 60) {
    const tokens = await refreshAccessToken(refreshToken);
    accessToken = tokens.access_token;

    cookieStore.set("strava_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    cookieStore.set("strava_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    cookieStore.set("strava_token_expires_at", String(tokens.expires_at), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const url = `${STRAVA_API_BASE}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
}

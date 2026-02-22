import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  cookieStore.set("demo_mode", "true", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  const url = request.nextUrl.clone();
  url.pathname = "/app";
  url.search = "";
  return NextResponse.redirect(url);
}

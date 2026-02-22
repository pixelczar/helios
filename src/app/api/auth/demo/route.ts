import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  cookieStore.set("demo_mode", "true", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/app`
  );
}

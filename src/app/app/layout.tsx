import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("strava_access_token");
  const demoMode = cookieStore.get("demo_mode");

  if (!accessToken && !demoMode) {
    redirect("/");
  }

  return <>{children}</>;
}

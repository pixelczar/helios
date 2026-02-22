import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/ui/LandingPage";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("strava_access_token");
  const demoMode = cookieStore.get("demo_mode");

  if (accessToken || demoMode) {
    redirect("/app");
  }

  return <LandingPage />;
}

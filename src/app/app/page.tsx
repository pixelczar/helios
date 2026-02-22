"use client";

import dynamic from "next/dynamic";
import { useActivities } from "@/hooks/useActivities";
import { HUD } from "@/components/ui/HUD";
import { RunStats } from "@/components/ui/RunStats";
import { RunCounter } from "@/components/ui/RunCounter";
import { ScrollIndicator } from "@/components/ui/ScrollIndicator";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { GoalsPanel } from "@/components/ui/GoalsPanel";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

const Scene = dynamic(
  () => import("@/components/canvas/Scene").then((m) => m.Scene),
  { ssr: false }
);

export default function AppPage() {
  const { activities, isLoading } = useActivities();

  return (
    <>
      <LoadingScreen show={isLoading && activities.length === 0} />

      {activities.length > 0 && (
        <>
          <Scene activityCount={activities.length} />
          <HUD>
            <RunStats />
            <RunCounter />
            <ScrollIndicator />
            <ThemeToggle />
            <GoalsPanel />
          </HUD>
        </>
      )}
    </>
  );
}

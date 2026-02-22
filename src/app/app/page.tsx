"use client";

import dynamic from "next/dynamic";
import { useActivities } from "@/hooks/useActivities";
import { useActivityStore } from "@/stores/activityStore";
import { HUD } from "@/components/ui/HUD";
import { RunStats } from "@/components/ui/RunStats";
import { RunCounter } from "@/components/ui/RunCounter";
import { ScrollIndicator } from "@/components/ui/ScrollIndicator";
import type { TimeRange } from "@/components/ui/SettingsPanel";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Leva } from "leva";
import { useState, useEffect } from "react";

const Scene = dynamic(
  () => import("@/components/canvas/Scene").then((m) => m.Scene),
  { ssr: false }
);

export default function AppPage() {
  const { activities, isLoading } = useActivities();
  const timeRange = useActivityStore((s) => s.timeRange) as TimeRange;
  const fetchAllForRange = useActivityStore((s) => s.fetchAllForRange);
  const [levaHidden, setLevaHidden] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ".") {
        e.preventDefault();
        setLevaHidden((h) => !h);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleTimeRangeChange = (range: TimeRange) => {
    fetchAllForRange(range);
  };

  return (
    <>
      <Leva collapsed hidden={levaHidden} />
      <LoadingScreen show={isLoading && activities.length === 0} />

      {activities.length > 0 && (
        <>
          <Scene activityCount={activities.length} />
          <HUD>
            <RunStats />
            <RunCounter
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
            />
            <ScrollIndicator />
          </HUD>
        </>
      )}
    </>
  );
}

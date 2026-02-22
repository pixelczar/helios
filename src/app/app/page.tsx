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
  const { activities, isLoading, error } = useActivities();
  const timeRange = useActivityStore((s) => s.timeRange) as TimeRange;
  const fetchAllForRange = useActivityStore((s) => s.fetchAllForRange);
  const [debugVisible, setDebugVisible] = useState(false);
  const doneWithNoData = !isLoading && activities.length === 0;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ".") {
        e.preventDefault();
        setDebugVisible((v) => !v);
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
      <Leva collapsed hidden={!debugVisible} />
      <LoadingScreen show={isLoading && activities.length === 0} />

      {doneWithNoData && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#050505] text-neutral-400">
          <p className="text-sm tracking-wide">
            {error ? "Failed to load activities" : "No runs found"}
          </p>
          <a
            href="/"
            className="mt-4 text-xs text-neutral-600 underline underline-offset-4 hover:text-neutral-400 transition-colors"
          >
            Back to home
          </a>
        </div>
      )}

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

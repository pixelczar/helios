"use client";

import dynamic from "next/dynamic";
import { useActivities } from "@/hooks/useActivities";
import { useActivityStore } from "@/stores/activityStore";
import { HUD } from "@/components/ui/HUD";
import { RunStats } from "@/components/ui/RunStats";
import { RunCounter } from "@/components/ui/RunCounter";
import { ScrollIndicator } from "@/components/ui/ScrollIndicator";
import { TodaySummary } from "@/components/ui/TodaySummary";
import type { TimeRange } from "@/components/ui/SettingsPanel";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnimatePresence, motion } from "framer-motion";
import { Leva } from "leva";
import { useState, useEffect } from "react";

export type ViewMode = "timeline" | "today";

const Scene = dynamic(
  () => import("@/components/canvas/Scene").then((m) => m.Scene),
  { ssr: false }
);

export default function AppPage() {
  const { activities, isLoading, error } = useActivities();
  const timeRange = useActivityStore((s) => s.timeRange) as TimeRange;
  const fetchAllForRange = useActivityStore((s) => s.fetchAllForRange);
  const [debugVisible, setDebugVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
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

      {doneWithNoData && <EmptyState error={error} />}

      {/* Scene — stays mounted, fades out in today mode */}
      <div
        className="transition-opacity duration-500"
        style={{
          opacity: viewMode === "timeline" ? 1 : 0,
          pointerEvents: viewMode === "timeline" ? "auto" : "none",
        }}
      >
        <Scene activityCount={activities.length} />
      </div>

      {/* Today summary */}
      <AnimatePresence>
        {viewMode === "today" && activities.length > 0 && (
          <motion.div
            key="today"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <TodaySummary />
          </motion.div>
        )}
      </AnimatePresence>

      {activities.length > 0 && (
        <HUD>
          {/* RunStats — only in timeline mode */}
          <AnimatePresence>
            {viewMode === "timeline" && (
              <motion.div
                key="run-stats"
                initial={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
                }}
              >
                <RunStats />
              </motion.div>
            )}
          </AnimatePresence>

          <RunCounter
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
          />
          <ScrollIndicator
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </HUD>
      )}
    </>
  );
}

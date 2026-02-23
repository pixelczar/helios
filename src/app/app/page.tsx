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

const EASE = [0.25, 0.1, 0.25, 1] as const;

const Scene = dynamic(
  () => import("@/components/canvas/Scene").then((m) => m.Scene),
  { ssr: false }
);

export default function AppPage() {
  const { activities, isLoading, error } = useActivities();
  const timeRange = useActivityStore((s) => s.timeRange) as TimeRange;
  const fetchAllForRange = useActivityStore((s) => s.fetchAllForRange);
  const currentIndex = useActivityStore((s) => s.currentIndex);
  const [debugVisible, setDebugVisible] = useState(false);
  const doneWithNoData = !isLoading && activities.length === 0;
  const isAtToday = currentIndex >= activities.length;

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

      <Scene activityCount={activities.length} />

      {/* Today summary — driven by scroll position */}
      <AnimatePresence>
        {isAtToday && activities.length > 0 && (
          <motion.div
            key="today"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <TodaySummary />
          </motion.div>
        )}
      </AnimatePresence>

      {activities.length > 0 && (
        <HUD>
          {/* RunStats — hidden when at Today (currentActivity will be null) */}
          <AnimatePresence>
            {!isAtToday && (
              <motion.div
                key="run-stats"
                className="absolute inset-0"
                initial={{ opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  filter: "blur(4px)",
                  transition: { duration: 0.3, ease: EASE },
                }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <RunStats />
              </motion.div>
            )}
          </AnimatePresence>

          <RunCounter
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
          />
          <ScrollIndicator />
        </HUD>
      )}
    </>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useActivities } from "@/hooks/useActivities";
import { useActivityStore } from "@/stores/activityStore";
import { fetchMapImage } from "@/lib/geo/mapTiles";
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
import { useState, useEffect, useRef } from "react";

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
  const [warmupDone, setWarmupDone] = useState(false);
  const warmupStarted = useRef(false);
  const doneWithNoData = !isLoading && activities.length === 0 && warmupDone;
  const isAtToday = currentIndex >= activities.length;

  // When the first activities arrive, kick off a warmup window:
  // the 3D scene renders behind the loading screen for 400ms so shaders
  // compile and geometries upload before the loading screen exits.
  // Also prefetch map tiles for the first visible cards.
  useEffect(() => {
    if (activities.length > 0 && !warmupStarted.current) {
      warmupStarted.current = true;
      const { decodedRoutes } = useActivityStore.getState();
      activities.slice(0, 10).forEach((activity) => {
        const decoded = decodedRoutes.get(activity.id);
        if (decoded?.points?.length) {
          fetchMapImage(activity.id, decoded.points);
        }
      });
      const t = window.setTimeout(() => setWarmupDone(true), 400);
      return () => window.clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities.length]);

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
      <LoadingScreen show={!warmupDone} />

      {doneWithNoData && <EmptyState error={error} />}

      <Scene activityCount={activities.length} isLoading={activities.length === 0} />

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

      <AnimatePresence>
        {activities.length > 0 && warmupDone && (
          <motion.div
            key="hud"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            className="fixed inset-0 z-10 pointer-events-none"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

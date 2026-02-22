"use client";

import { useActivityStore } from "@/stores/activityStore";

export function useScrollIndex() {
  const currentIndex = useActivityStore((s) => s.currentIndex);
  const activities = useActivityStore((s) => s.activities);

  return {
    currentActivity: activities[currentIndex] ?? null,
    currentIndex,
    totalRuns: activities.length,
  };
}

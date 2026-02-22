"use client";

import { useEffect } from "react";
import { useActivityStore } from "@/stores/activityStore";

export function useActivities() {
  const activities = useActivityStore((s) => s.activities);
  const isLoading = useActivityStore((s) => s.isLoading);
  const error = useActivityStore((s) => s.error);
  const fetchActivities = useActivityStore((s) => s.fetchActivities);

  useEffect(() => {
    if (activities.length === 0 && !isLoading) {
      fetchActivities(1);
    }
  }, [activities.length, isLoading, fetchActivities]);

  return { activities, isLoading, error };
}

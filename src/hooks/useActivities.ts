"use client";

import { useEffect, useRef } from "react";
import { useActivityStore } from "@/stores/activityStore";

export function useActivities() {
  const activities = useActivityStore((s) => s.activities);
  const isLoading = useActivityStore((s) => s.isLoading);
  const error = useActivityStore((s) => s.error);
  const timeRange = useActivityStore((s) => s.timeRange);
  const fetchAllForRange = useActivityStore((s) => s.fetchAllForRange);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchAllForRange(timeRange);
    }
  }, [timeRange, fetchAllForRange]);

  return { activities, isLoading, error };
}

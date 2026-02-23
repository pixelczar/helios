"use client";

import { create } from "zustand";
import type { StravaActivity, DecodedRoute } from "@/lib/strava/types";
import { decodePolyline } from "@/lib/geo/polyline";
import { normalizeRoute, getNormalizationParams } from "@/lib/geo/normalize";
import { simplifyRoute } from "@/lib/geo/simplify";

interface ActivityState {
  activities: StravaActivity[];
  decodedRoutes: Map<number, DecodedRoute>;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  timeRange: "year" | "all";

  // Scroll state (written by 3D scene, read by DOM overlay)
  currentIndex: number;
  scrollProgress: number;

  fetchActivities: (page?: number) => Promise<void>;
  fetchAllForRange: (range: "year" | "all") => Promise<void>;
  decodeAndCacheRoute: (activity: StravaActivity) => void;
  setScrollState: (index: number, progress: number) => void;
  setTimeRange: (range: "year" | "all") => void;
}

function getAfterEpoch(range: "year" | "all"): number | null {
  if (range === "all") return null;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  return Math.floor(yearStart.getTime() / 1000);
}

function decodeActivities(
  runs: StravaActivity[],
  existingRoutes: Map<number, DecodedRoute>
): Map<number, DecodedRoute> {
  const newRoutes = new Map(existingRoutes);
  for (const activity of runs) {
    if (activity.map.summary_polyline && !newRoutes.has(activity.id)) {
      const points = decodePolyline(activity.map.summary_polyline);
      const simplified =
        points.length > 800 ? simplifyRoute(points, 0.00002) : points;
      const normalized = normalizeRoute(simplified, 5);
      const normParams = getNormalizationParams(simplified, 5);
      newRoutes.set(activity.id, {
        activityId: activity.id,
        points,
        normalized,
        normParams: normParams ?? undefined,
      });
    }
  }
  return newRoutes;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  decodedRoutes: new Map(),
  isLoading: true,
  error: null,
  currentPage: 1,
  hasMore: true,
  timeRange: "year",
  currentIndex: 0,
  scrollProgress: 0,

  fetchActivities: async (page = 1) => {
    const { timeRange } = get();
    const after = getAfterEpoch(timeRange);
    set({ isLoading: true, error: null });
    try {
      let url = `/api/activities?page=${page}&per_page=50`;
      if (after) url += `&after=${after}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");

      const runs: StravaActivity[] = await res.json();

      set((state) => {
        const newActivities =
          page === 1 ? runs : [...state.activities, ...runs];
        const newRoutes = decodeActivities(runs, state.decodedRoutes);

        return {
          activities: newActivities,
          decodedRoutes: newRoutes,
          currentPage: page,
          hasMore: runs.length === 50,
          isLoading: false,
        };
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  fetchAllForRange: async (range: "year" | "all") => {
    const after = getAfterEpoch(range);
    set({
      isLoading: true,
      error: null,
      activities: [],
      decodedRoutes: new Map(),
      currentIndex: 0,
      scrollProgress: 0,
      timeRange: range,
    });

    try {
      let page = 1;
      let allRuns: StravaActivity[] = [];
      let hasMore = true;

      while (hasMore) {
        let url = `/api/activities?page=${page}&per_page=200`;
        if (after) url += `&after=${after}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");

        const runs: StravaActivity[] = await res.json();
        allRuns = [...allRuns, ...runs];

        // Update incrementally so the UI shows progress
        set((state) => {
          const newRoutes = decodeActivities(runs, state.decodedRoutes);
          return {
            activities: allRuns,
            decodedRoutes: newRoutes,
            currentPage: page,
          };
        });

        // "all" is capped at one page (200) to avoid overwhelming the renderer
        hasMore = range !== "all" && runs.length === 200;
        page++;
      }

      set({ isLoading: false, hasMore: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  setTimeRange: (range) => {
    set({ timeRange: range });
  },

  decodeAndCacheRoute: (activity) => {
    const polyline = activity.map.polyline || activity.map.summary_polyline;
    if (!polyline) return;

    const points = decodePolyline(polyline);
    const simplified = points.length > 800 ? simplifyRoute(points, 0.00002) : points;
    const normalized = normalizeRoute(simplified, 5);
    const normParams = getNormalizationParams(simplified, 5);

    set((state) => {
      const newRoutes = new Map(state.decodedRoutes);
      newRoutes.set(activity.id, {
        activityId: activity.id,
        points,
        normalized,
        normParams: normParams ?? undefined,
      });
      return { decodedRoutes: newRoutes };
    });
  },

  setScrollState: (index, progress) => {
    const state = get();
    if (state.currentIndex !== index || state.scrollProgress !== progress) {
      set({ currentIndex: index, scrollProgress: progress });
    }
  },
}));

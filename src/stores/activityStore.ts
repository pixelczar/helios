"use client";

import { create } from "zustand";
import type { StravaActivity, DecodedRoute } from "@/lib/strava/types";
import { decodePolyline } from "@/lib/geo/polyline";
import { normalizeRoute } from "@/lib/geo/normalize";
import { simplifyRoute } from "@/lib/geo/simplify";

interface ActivityState {
  activities: StravaActivity[];
  decodedRoutes: Map<number, DecodedRoute>;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;

  // Scroll state (written by 3D scene, read by DOM overlay)
  currentIndex: number;
  scrollProgress: number;

  fetchActivities: (page?: number) => Promise<void>;
  decodeAndCacheRoute: (activity: StravaActivity) => void;
  setScrollState: (index: number, progress: number) => void;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  decodedRoutes: new Map(),
  isLoading: false,
  error: null,
  currentPage: 1,
  hasMore: true,
  currentIndex: 0,
  scrollProgress: 0,

  fetchActivities: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/activities?page=${page}&per_page=50`);
      if (!res.ok) throw new Error("Failed to fetch");

      const runs: StravaActivity[] = await res.json();

      set((state) => {
        const newActivities =
          page === 1 ? runs : [...state.activities, ...runs];

        // Decode routes for all new activities
        const newRoutes = new Map(state.decodedRoutes);
        for (const activity of runs) {
          if (activity.map.summary_polyline && !newRoutes.has(activity.id)) {
            const points = decodePolyline(activity.map.summary_polyline);
            const simplified =
              points.length > 500 ? simplifyRoute(points) : points;
            const normalized = normalizeRoute(simplified);
            newRoutes.set(activity.id, {
              activityId: activity.id,
              points,
              normalized,
            });
          }
        }

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

  decodeAndCacheRoute: (activity) => {
    const polyline = activity.map.polyline || activity.map.summary_polyline;
    if (!polyline) return;

    const points = decodePolyline(polyline);
    const simplified = points.length > 500 ? simplifyRoute(points) : points;
    const normalized = normalizeRoute(simplified);

    set((state) => {
      const newRoutes = new Map(state.decodedRoutes);
      newRoutes.set(activity.id, {
        activityId: activity.id,
        points,
        normalized,
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

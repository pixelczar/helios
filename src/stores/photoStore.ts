"use client";

import { create } from "zustand";
import type { ActivityPhoto } from "@/lib/strava/types";

interface PhotoState {
  photos: Map<number, ActivityPhoto[]>;
  loading: Set<number>;
  fetchPhotos: (activityId: number) => Promise<void>;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: new Map(),
  loading: new Set(),

  fetchPhotos: async (activityId: number) => {
    const { photos, loading } = get();
    if (photos.has(activityId) || loading.has(activityId)) return;

    set((s) => {
      const next = new Set(s.loading);
      next.add(activityId);
      return { loading: next };
    });

    try {
      const res = await fetch(`/api/activities/${activityId}/photos?size=600`);
      if (!res.ok) throw new Error("Failed to fetch photos");
      const data: ActivityPhoto[] = await res.json();

      set((s) => {
        const nextPhotos = new Map(s.photos);
        nextPhotos.set(activityId, data);
        const nextLoading = new Set(s.loading);
        nextLoading.delete(activityId);
        return { photos: nextPhotos, loading: nextLoading };
      });
    } catch {
      set((s) => {
        const nextLoading = new Set(s.loading);
        nextLoading.delete(activityId);
        return { loading: nextLoading };
      });
    }
  },
}));

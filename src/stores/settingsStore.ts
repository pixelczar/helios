"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  showMapOverlay: boolean;
  setShowMapOverlay: (show: boolean) => void;
  hiddenGoalIds: string[];
  toggleGoalVisibility: (id: string) => void;
  isGoalVisible: (id: string) => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      showMapOverlay: true,
      setShowMapOverlay: (show) => set({ showMapOverlay: show }),
      // Goals hidden from the HUD gauges — "default-weekly-runs" hidden by default
      hiddenGoalIds: ["default-weekly-runs"],
      toggleGoalVisibility: (id) =>
        set((state) => {
          const hidden = state.hiddenGoalIds.includes(id);
          return {
            hiddenGoalIds: hidden
              ? state.hiddenGoalIds.filter((x) => x !== id)
              : [...state.hiddenGoalIds, id],
          };
        }),
      isGoalVisible: (id) => !get().hiddenGoalIds.includes(id),
    }),
    {
      name: "fun-run-settings",
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          return { ...state, hiddenGoalIds: ["default-weekly-runs"] };
        }
        return state;
      },
    }
  )
);

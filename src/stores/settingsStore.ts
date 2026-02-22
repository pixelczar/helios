"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  showMapOverlay: boolean;
  setShowMapOverlay: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showMapOverlay: false,
      setShowMapOverlay: (show) => set({ showMapOverlay: show }),
    }),
    { name: "fun-run-settings", version: 1 }
  )
);

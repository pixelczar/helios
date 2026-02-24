"use client";

import { create } from "zustand";

interface PhotoModalState {
  expandedPhotoUid: string | null;
  setExpandedPhotoUid: (uid: string | null) => void;
}

export const usePhotoModalStore = create<PhotoModalState>((set) => ({
  expandedPhotoUid: null,
  setExpandedPhotoUid: (uid) => set({ expandedPhotoUid: uid }),
}));

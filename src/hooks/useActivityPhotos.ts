"use client";

import { useEffect } from "react";
import { usePhotoStore } from "@/stores/photoStore";

export function useActivityPhotos(
  activityId: number | null,
  photoCount: number
) {
  const photos = usePhotoStore((s) =>
    activityId ? s.photos.get(activityId) : undefined
  );
  const isLoading = usePhotoStore((s) =>
    activityId ? s.loading.has(activityId) : false
  );
  const fetchPhotos = usePhotoStore((s) => s.fetchPhotos);

  useEffect(() => {
    if (activityId && photoCount > 0 && !photos) {
      fetchPhotos(activityId);
    }
  }, [activityId, photoCount, photos, fetchPhotos]);

  return { photos: photos ?? [], isLoading };
}

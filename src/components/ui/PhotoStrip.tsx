"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useActivityPhotos } from "@/hooks/useActivityPhotos";

const EASE = [0.25, 0.1, 0.25, 1] as const;

interface PhotoStripProps {
  activityId: number;
  photoCount: number;
}

export function PhotoStrip({ activityId, photoCount }: PhotoStripProps) {
  const { photos, isLoading } = useActivityPhotos(activityId, photoCount);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  if (photoCount === 0) return null;

  // Use primary photo URLs from the activity if photos haven't loaded yet
  const thumbnails = photos.slice(0, 4);

  return (
    <>
      <div className="flex gap-1.5 mt-4">
        {isLoading && thumbnails.length === 0
          ? // Skeleton placeholders
            Array.from({ length: Math.min(photoCount, 4) }).map((_, i) => (
              <div
                key={i}
                className="w-12 h-12 rounded-lg bg-neutral-800 animate-pulse"
              />
            ))
          : thumbnails.map((photo, i) => {
              const url = photo.urls?.["600"] || Object.values(photo.urls)[0];
              if (!url) return null;
              return (
                <motion.button
                  key={photo.unique_id}
                  layoutId={`photo-${photo.unique_id}`}
                  onClick={() => setExpandedIndex(i)}
                  className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 cursor-pointer"
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                  }
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.4,
                    delay: i * 0.06,
                    ease: EASE,
                  }}
                  whileHover={{ scale: 1.08 }}
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </motion.button>
              );
            })}
      </div>

      {/* Expanded photo modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {expandedIndex !== null && thumbnails[expandedIndex] && (
              <>
                {/* Blur scrim */}
                <motion.div
                  className="fixed inset-0 z-40"
                  initial={{
                    backgroundColor: "rgba(0,0,0,0)",
                    backdropFilter: "blur(0px)",
                  }}
                  animate={{
                    backgroundColor: "rgba(0,0,0,0.6)",
                    backdropFilter: "blur(12px)",
                  }}
                  exit={{
                    backgroundColor: "rgba(0,0,0,0)",
                    backdropFilter: "blur(0px)",
                  }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.35,
                    ease: EASE,
                  }}
                  onClick={() => setExpandedIndex(null)}
                />

                {/* Photo */}
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
                  initial={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.9 }
                  }
                  animate={
                    reducedMotion
                      ? { opacity: 1 }
                      : { opacity: 1, scale: 1 }
                  }
                  exit={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.9 }
                  }
                  transition={{
                    duration: reducedMotion ? 0 : 0.35,
                    ease: EASE,
                  }}
                >
                  <img
                    src={
                      thumbnails[expandedIndex].urls?.["600"] ||
                      Object.values(thumbnails[expandedIndex].urls)[0]
                    }
                    alt={thumbnails[expandedIndex].caption || ""}
                    className="max-w-full max-h-full rounded-xl shadow-2xl shadow-black/60 pointer-events-auto cursor-pointer"
                    onClick={() => setExpandedIndex(null)}
                  />
                </motion.div>

                {/* Caption */}
                {thumbnails[expandedIndex].caption && (
                  <motion.p
                    className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 text-sm text-neutral-300 italic text-center max-w-md"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{
                      duration: reducedMotion ? 0 : 0.3,
                      delay: 0.1,
                      ease: EASE,
                    }}
                  >
                    {thumbnails[expandedIndex].caption}
                  </motion.p>
                )}
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

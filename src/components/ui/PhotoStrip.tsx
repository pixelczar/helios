"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  MotionValue,
} from "framer-motion";
import { useActivityPhotos } from "@/hooks/useActivityPhotos";
import { usePhotoModalStore } from "@/stores/photoModalStore";

const EASE = [0.25, 0.1, 0.25, 1] as const;

interface PhotoStripProps {
  activityId: number;
  photoCount: number;
}

// Luxury tilt card — 3D perspective physics + specular sheen
function TiltCard({
  children,
  reducedMotion,
  glowBoxShadow,
}: {
  children: React.ReactNode;
  reducedMotion: boolean | null;
  glowBoxShadow: MotionValue<string>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 380,
    damping: 32,
    mass: 0.6,
  });
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [8, -8]), {
    stiffness: 380,
    damping: 32,
    mass: 0.6,
  });

  // Specular highlight position
  const sheenX = useTransform(rawX, [-0.5, 0.5], ["10%", "90%"]);
  const sheenY = useTransform(rawY, [-0.5, 0.5], ["10%", "90%"]);
  const sheenBg = useTransform(
    [sheenX, sheenY] as MotionValue[],
    ([x, y]: (string | number)[]) =>
      `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.09) 0%, transparent 60%)`
  );

  // Shadow shifts with tilt — deeper on the "down" side
  const shadowX = useTransform(rawX, [-0.5, 0.5], [-12, 12]);
  const shadowY = useTransform(rawY, [-0.5, 0.5], [12, -12]);
  const dynamicShadow = useTransform(
    [shadowX, shadowY, glowBoxShadow] as MotionValue[],
    ([sx, sy, glow]: (string | number)[]) =>
      `${glow}, ${sx}px ${sy}px 40px rgba(0,0,0,0.55)`
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    // Clamp to ±0.35 so the outer ~15% of the card is a dead zone — avoids
    // jarring max-tilt snaps when the cursor grazes the edge
    const clamp = (v: number) => Math.max(-0.35, Math.min(0.35, v));
    rawX.set(clamp((e.clientX - rect.left) / rect.width - 0.5));
    rawY.set(clamp((e.clientY - rect.top) / rect.height - 0.5));
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <div style={{ perspective: "900px" }}>
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: reducedMotion ? 0 : rotateX,
          rotateY: reducedMotion ? 0 : rotateY,
          transformStyle: "preserve-3d",
          boxShadow: dynamicShadow,
          borderRadius: "0.75rem",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}

        {/* Specular sheen overlay */}
        {!reducedMotion && (
          <motion.div
            style={{
              background: sheenBg,
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              pointerEvents: "none",
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

export function PhotoStrip({ activityId, photoCount }: PhotoStripProps) {
  const { photos, isLoading } = useActivityPhotos(activityId, photoCount);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  // Bridge: 3D pin clicks open the modal
  const expandedPhotoUid = usePhotoModalStore((s) => s.expandedPhotoUid);
  const setExpandedPhotoUid = usePhotoModalStore((s) => s.setExpandedPhotoUid);

  useEffect(() => {
    if (!expandedPhotoUid) return;
    const idx = photos.findIndex((p) => p.unique_id === expandedPhotoUid);
    if (idx !== -1) setExpandedIndex(idx);
  }, [expandedPhotoUid, photos]);

  const handleClose = () => {
    setExpandedIndex(null);
    setExpandedPhotoUid(null);
  };

  // Bloom glow box-shadow — animates in after card settles
  const glowRaw = useMotionValue(0);
  const glowOpacity = useSpring(glowRaw, { stiffness: 120, damping: 20 });
  const glowBoxShadow = useTransform(
    glowOpacity,
    (o) =>
      `0 0 0 1px rgba(52,211,153,${(o * 0.2).toFixed(3)}), 0 0 24px rgba(52,211,153,${(o * 0.18).toFixed(3)}), 0 0 80px rgba(52,211,153,${(o * 0.07).toFixed(3)})`
  );

  // Animate glow in after modal opens
  useEffect(() => {
    if (expandedIndex !== null) {
      const t = setTimeout(() => {
        glowRaw.set(1);
      }, reducedMotion ? 0 : 180);
      return () => clearTimeout(t);
    } else {
      glowRaw.set(0);
    }
  }, [expandedIndex, reducedMotion, glowRaw]);

  if (photoCount === 0) return null;

  const thumbnails = photos.slice(0, 4);

  return (
    <>
      <div className="flex gap-1.5 mt-6">
        {isLoading && thumbnails.length === 0
          ? Array.from({ length: Math.min(photoCount, 4) }).map((_, i) => (
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
                  className="w-20 h-20 rounded-lg overflow-hidden border-0 border-white/40 cursor-pointer ring-1 ring-inset ring-black/50"
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                  }
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.3,
                    delay: i * 0.06,
                    ease: EASE,
                    // Override for scale — no stagger delay, spring physics
                    scale: { type: "spring", stiffness: 200, damping: 26 },
                  }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
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
                    backgroundColor: "rgba(0,0,0,0.65)",
                    backdropFilter: "blur(14px)",
                  }}
                  exit={{
                    backgroundColor: "rgba(0,0,0,0)",
                    backdropFilter: "blur(0px)",
                  }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.35,
                    ease: EASE,
                  }}
                  onClick={handleClose}
                />

                {/* Photo card */}
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
                  initial={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.88, y: 16 }
                  }
                  animate={
                    reducedMotion
                      ? { opacity: 1 }
                      : { opacity: 1, scale: 1, y: 0 }
                  }
                  exit={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.92, y: 8 }
                  }
                  transition={{
                    duration: reducedMotion ? 0 : 0.38,
                    ease: EASE,
                  }}
                >
                  <div className="pointer-events-auto cursor-pointer" onClick={handleClose}>
                    <TiltCard
                      reducedMotion={reducedMotion}
                      glowBoxShadow={glowBoxShadow}
                    >
                      <img
                        src={
                          thumbnails[expandedIndex].urls?.["600"] ||
                          Object.values(thumbnails[expandedIndex].urls)[0]
                        }
                        alt={thumbnails[expandedIndex].caption || ""}
                        className="max-w-full max-h-[80vh] block"
                        style={{ maxWidth: "min(90vw, 900px)" }}
                      />
                    </TiltCard>
                  </div>
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
                      delay: 0.15,
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

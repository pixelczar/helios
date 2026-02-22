"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useActivityStore } from "@/stores/activityStore";
import { useGoalStore, calculateYearlyPaceAtDate } from "@/stores/goalStore";

// Ahead of pace = cyan, behind = amber, on pace = white
const AHEAD_COLOR = "#00ffcc";
const BEHIND_COLOR = "#ff8844";
const NEUTRAL_COLOR = "#555555";

export function ScrollIndicator() {
  const currentIndex = useActivityStore((s) => s.currentIndex);
  const activities = useActivityStore((s) => s.activities);
  const yearlyTarget = useGoalStore((s) => s.yearlyTarget);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [hovered, setHovered] = useState(false);

  const totalRuns = activities.length;
  const progress = totalRuns > 1 ? currentIndex / (totalRuns - 1) : 0;

  // Compute pace status at each run position
  const paceData = useMemo(() => {
    if (activities.length === 0) return [];
    return activities.map((activity) => {
      const date = new Date(activity.start_date_local);
      const { ratio } = calculateYearlyPaceAtDate(
        activities,
        yearlyTarget,
        date
      );
      return { ratio };
    });
  }, [activities, yearlyTarget]);

  // Build SVG gradient stops from pace data
  const gradientStops = useMemo(() => {
    if (paceData.length === 0) return [];
    return paceData.map((d, i) => {
      const t = totalRuns > 1 ? i / (totalRuns - 1) : 0.5;
      const blend = Math.max(0, Math.min(1, (d.ratio - 0.8) / 0.4));
      return { offset: t, blend };
    });
  }, [paceData, totalRuns]);

  const findScrollContainer = useCallback((): HTMLElement | null => {
    const candidates = document.querySelectorAll("div");
    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflow === "auto" || style.overflow === "scroll" ||
         style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 100
      ) {
        return el;
      }
    }
    return null;
  }, []);

  const scrollToProgress = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const container = findScrollContainer();
      if (container) {
        const scrollable = container.scrollHeight - container.clientHeight;
        container.scrollTop = t * scrollable;
      }
    },
    [findScrollContainer]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      scrollToProgress(e.clientY);
    },
    [scrollToProgress]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      scrollToProgress(e.clientY);
    },
    [scrollToProgress]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  if (totalRuns === 0) return null;

  // Dot-centered illumination mask (default state)
  const dotMask = `linear-gradient(
    to bottom,
    transparent 0%,
    transparent ${Math.max(0, progress * 100 - 20)}%,
    rgba(255,255,255,0.05) ${Math.max(0, progress * 100 - 12)}%,
    rgba(255,255,255,0.3) ${Math.max(0, progress * 100 - 5)}%,
    rgba(255,255,255,1) ${progress * 100}%,
    rgba(255,255,255,0.3) ${Math.min(100, progress * 100 + 5)}%,
    rgba(255,255,255,0.05) ${Math.min(100, progress * 100 + 12)}%,
    transparent ${Math.min(100, progress * 100 + 20)}%,
    transparent 100%
  )`;

  // Full reveal mask (hover state) — shows the entire gradient
  const fullMask = "linear-gradient(to bottom, rgba(255,255,255,0.7) 0%, rgba(255,255,255,1) 10%, rgba(255,255,255,1) 90%, rgba(255,255,255,0.7) 100%)";

  const activeMask = hovered || isDragging.current ? fullMask : dotMask;

  const currentColor =
    paceData[currentIndex]?.ratio >= 1 ? AHEAD_COLOR : BEHIND_COLOR;

  return (
    <div
      ref={trackRef}
      className="absolute right-4 top-1/2 -translate-y-1/2 h-[40vh] w-8 pointer-events-auto cursor-pointer flex items-center justify-center select-none group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Base track (always visible, very dim) */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[1.5px] h-full bg-white/[0.04] rounded-full" />

      {/* Colored pace track — mask transitions between dot-centered and full reveal */}
      <div
        className="absolute left-1/2 -translate-x-1/2 h-full rounded-full overflow-hidden"
        style={{
          width: hovered ? "3px" : "1.5px",
          maskImage: activeMask,
          WebkitMaskImage: activeMask,
          transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1), mask-image 0.4s ease, -webkit-mask-image 0.4s ease",
        }}
      >
        <svg
          width="3"
          height="100%"
          viewBox="0 0 3 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient
              id="paceGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              {gradientStops.length > 0 ? (
                gradientStops.map((stop, i) => (
                  <stop
                    key={i}
                    offset={`${stop.offset * 100}%`}
                    stopColor={
                      stop.blend > 0.6
                        ? AHEAD_COLOR
                        : stop.blend < 0.4
                          ? BEHIND_COLOR
                          : NEUTRAL_COLOR
                    }
                    stopOpacity={0.9}
                  />
                ))
              ) : (
                <stop offset="0%" stopColor={NEUTRAL_COLOR} />
              )}
            </linearGradient>
          </defs>
          <rect
            x="0"
            y="0"
            width="3"
            height="100"
            fill="url(#paceGradient)"
          />
        </svg>
      </div>

      {/* Hover label — shows pace status */}
      <AnimatePresence>
        {hovered && paceData[currentIndex] && (
          <motion.div
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ duration: 0.2 }}
            className="absolute right-10 whitespace-nowrap"
            style={{ top: `${progress * 100}%`, transform: "translateY(-50%)" }}
          >
            <span
              className="text-[11px] font-medium tabular-nums"
              style={{ color: currentColor }}
            >
              {paceData[currentIndex].ratio >= 1 ? "+" : ""}
              {((paceData[currentIndex].ratio - 1) * 100).toFixed(0)}% pace
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dot with glow */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 z-10"
        animate={{ top: `${progress * 100}%` }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* Glow halo */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: hovered ? "32px" : "24px",
            height: hovered ? "32px" : "24px",
            opacity: hovered ? 0.5 : 0.3,
            background: `radial-gradient(circle, ${currentColor} 0%, transparent 70%)`,
            transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        {/* Dot */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: hovered ? "10px" : "8px",
            height: hovered ? "10px" : "8px",
            backgroundColor: currentColor,
            boxShadow: `0 0 ${hovered ? "12px" : "8px"} ${currentColor}40`,
            transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </motion.div>
    </div>
  );
}

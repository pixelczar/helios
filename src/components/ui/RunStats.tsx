"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, animate } from "framer-motion";
import { useScrollIndex } from "@/hooks/useScrollIndex";
import { PhotoStrip } from "./PhotoStrip";
import {
  formatDistance,
  formatPace,
  formatDate,
  formatDuration,
  formatElevation,
} from "@/lib/format";

const STAGGER = 0.06;
const EASE = [0.25, 0.1, 0.25, 1] as const;

function itemVariants(i: number, reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    };
  }
  return {
    initial: { opacity: 0, y: 14, filter: "blur(4px)" },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.45, delay: i * STAGGER, ease: EASE },
    },
    exit: {
      opacity: 0,
      y: -10,
      filter: "blur(4px)",
      transition: { duration: 0.22, delay: i * 0.015, ease: EASE },
    },
  };
}

export function RunStats() {
  const { currentActivity } = useScrollIndex();
  const reducedMotion = useReducedMotion();

  if (!currentActivity) return null;

  // No "wait" mode — outgoing stats fade while the next ones rise in
  return (
    <AnimatePresence>
      <motion.div
        key={currentActivity.id}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute bottom-28 left-4 right-4 md:bottom-auto md:right-auto md:top-1/2 md:-translate-y-1/2 md:left-10 pointer-events-auto"
      >
        {/* Date */}
        <motion.p
          variants={itemVariants(0, reducedMotion)}
          className="text-[12px] font-mono uppercase tracking-[0.2em] text-neutral-500 mb-4"
        >
          {formatDate(currentActivity.start_date_local)}
        </motion.p>

        {/* Run name */}
        <motion.p
          variants={itemVariants(1, reducedMotion)}
          className="text-[12px] italic font-sans uppercase tracking-widest text-neutral-400 mb-2"
        >
          {currentActivity.name}
        </motion.p>

        {/* Indoor/manual activity badge */}
        {!currentActivity.map.summary_polyline && (
          <motion.p
            variants={itemVariants(1, reducedMotion)}
            className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-2"
          >
            Indoor run
          </motion.p>
        )}

        {/* Distance — big, fat, italic */}
        <motion.p
          variants={itemVariants(2, reducedMotion)}
          className="text-6xl md:text-9xl font-black italic text-foreground tracking-tighter tabular-nums"
        >
          <CountUp meters={currentActivity.distance} reducedMotion={reducedMotion} />
          <span className="text-base text-neutral-500 ml-2 font-normal tracking-normal italic">
            mi
          </span>
        </motion.p>

        {/* Stat row */}
        <div className="flex flex-row gap-8 mt-5">
          <Stat
            index={3}
            label="Pace"
            value={formatPace(currentActivity.average_speed)}
            unit="/mi"
            reducedMotion={reducedMotion}
          />
          <Stat
            index={4}
            label="Elevation"
            value={formatElevation(currentActivity.total_elevation_gain)}
            unit="ft"
            reducedMotion={reducedMotion}
          />
          <Stat
            index={5}
            label="Time"
            value={formatDuration(currentActivity.moving_time)}
            reducedMotion={reducedMotion}
          />
        </div>

        {/* Photos */}
        {currentActivity.total_photo_count > 0 && (
          <motion.div variants={itemVariants(6, reducedMotion)}>
            <PhotoStrip
              activityId={currentActivity.id}
              photoCount={currentActivity.total_photo_count}
            />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Distance rolls up from ~80% to its final value as it blurs in — a quick
// settle, not a slot machine. Writes straight to the DOM to skip re-renders.
function CountUp({
  meters,
  reducedMotion,
}: {
  meters: number;
  reducedMotion: boolean | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = formatDistance(meters);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;
    const controls = animate(meters * 0.8, meters, {
      duration: 0.7,
      delay: 2 * STAGGER,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = formatDistance(v);
      },
    });
    return () => controls.stop();
  }, [meters, reducedMotion]);

  return <span ref={ref}>{final}</span>;
}

function Stat({
  index,
  label,
  value,
  unit,
  reducedMotion,
}: {
  index: number;
  label: string;
  value: string;
  unit?: string;
  reducedMotion: boolean | null;
}) {
  return (
    <motion.div variants={itemVariants(index, reducedMotion)}>
      <p className="text-[12px] font-mono uppercase tracking-widest text-neutral-600 mb-1">
        {label}
      </p>
      <p className="text-base italic font-sans text-neutral-300 tabular-nums font-normal">
        {value}
        {unit && (
          <span className="text-xs text-neutral-600 ml-1">{unit}</span>
        )}
      </p>
    </motion.div>
  );
}

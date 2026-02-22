"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useScrollIndex } from "@/hooks/useScrollIndex";
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
      transition: { duration: 0.3, delay: i * 0.03, ease: EASE },
    },
  };
}

export function RunStats() {
  const { currentActivity } = useScrollIndex();
  const reducedMotion = useReducedMotion();

  if (!currentActivity) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentActivity.id}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute top-10 left-10 pointer-events-auto"
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

        {/* Distance — big, fat, italic */}
        <motion.p
          variants={itemVariants(2, reducedMotion)}
          className="text-9xl font-black italic text-foreground tracking-tighter"
        >
          {formatDistance(currentActivity.distance)}
          <span className="text-lg text-neutral-500 ml-2 font-normal tracking-normal italic">
            mi
          </span>
        </motion.p>

        {/* Stat row */}
        <div className="flex gap-8 mt-5">
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
      </motion.div>
    </AnimatePresence>
  );
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
      <p className="text-sm font-sans text-neutral-300 tabular-nums font-light">
        {value}
        {unit && (
          <span className="text-xs text-neutral-600 ml-1">{unit}</span>
        )}
      </p>
    </motion.div>
  );
}

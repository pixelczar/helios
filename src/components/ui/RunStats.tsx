"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useScrollIndex } from "@/hooks/useScrollIndex";
import {
  formatDistance,
  formatPace,
  formatDate,
  formatDuration,
} from "@/lib/format";

export function RunStats() {
  const { currentActivity } = useScrollIndex();

  if (!currentActivity) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentActivity.id}
        initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="absolute bottom-12 left-12 pointer-events-auto"
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500 mb-2 font-medium">
          {formatDate(currentActivity.start_date_local)}
        </p>
        <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-400 mb-1">
          {currentActivity.name}
        </p>
        <p className="text-5xl font-extralight text-[var(--foreground)] tabular-nums leading-none">
          {formatDistance(currentActivity.distance)}
          <span className="text-base text-neutral-500 ml-2 font-normal">
            km
          </span>
        </p>
        <div className="flex gap-8 mt-4">
          <Stat label="Pace" value={formatPace(currentActivity.average_speed)} unit="/km" />
          <Stat
            label="Elevation"
            value={`${currentActivity.total_elevation_gain.toFixed(0)}`}
            unit="m"
          />
          <Stat label="Time" value={formatDuration(currentActivity.moving_time)} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-600 mb-0.5">
        {label}
      </p>
      <p className="text-sm text-neutral-300 tabular-nums font-light">
        {value}
        {unit && (
          <span className="text-[10px] text-neutral-600 ml-0.5">{unit}</span>
        )}
      </p>
    </div>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useScrollIndex } from "@/hooks/useScrollIndex";

export function RunCounter() {
  const { currentIndex, totalRuns } = useScrollIndex();

  if (totalRuns === 0) return null;

  return (
    <div className="absolute bottom-12 right-12 pointer-events-auto">
      <div className="flex items-baseline gap-1">
        <AnimatePresence mode="wait">
          <motion.span
            key={currentIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-2xl font-extralight text-neutral-300 tabular-nums"
          >
            {currentIndex + 1}
          </motion.span>
        </AnimatePresence>
        <span className="text-xs text-neutral-600 font-light">
          / {totalRuns}
        </span>
      </div>
    </div>
  );
}

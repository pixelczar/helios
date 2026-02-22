"use client";

import { motion } from "framer-motion";
import { useActivityStore } from "@/stores/activityStore";

export function ScrollIndicator() {
  const currentIndex = useActivityStore((s) => s.currentIndex);
  const totalRuns = useActivityStore((s) => s.activities).length;

  if (totalRuns === 0) return null;

  const progress = totalRuns > 1 ? currentIndex / (totalRuns - 1) : 0;

  return (
    <div className="absolute right-6 top-1/2 -translate-y-1/2 h-[40vh] w-px pointer-events-none">
      {/* Track */}
      <div className="w-full h-full bg-neutral-800 rounded-full overflow-hidden">
        {/* Progress */}
        <motion.div
          className="w-full bg-neutral-500 rounded-full origin-top"
          animate={{ scaleY: progress }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          style={{ height: "100%", transformOrigin: "top" }}
        />
      </div>
      {/* Active dot */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-neutral-300 rounded-full"
        animate={{ top: `${progress * 100}%` }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      />
    </div>
  );
}

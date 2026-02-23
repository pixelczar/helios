"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* A closed-loop route SVG path */
const ROUTE_PATH =
  "M 90 145 C 55 138, 32 112, 40 82 C 48 52, 78 35, 112 40 C 146 45, 168 72, 160 105 C 152 138, 120 152, 90 145 Z";

function RouteLoop({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
      <svg
        width="160"
        height="160"
        viewBox="20 10 200 170"
        fill="none"
      >
        <defs>
          <filter id="loader-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="loader-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,136,68,0.25)" />
            <stop offset="100%" stopColor="rgba(0,255,204,0.25)" />
          </linearGradient>
        </defs>

        {/* Faint static trace */}
        <path
          d={ROUTE_PATH}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Animated draw-in */}
        <motion.path
          d={ROUTE_PATH}
          stroke="url(#loader-grad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          filter="url(#loader-glow)"
          initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }
          }
        />

        {/* Start/end dot at loop junction */}
        <motion.circle
          cx="90"
          cy="145"
          r="2.5"
          fill="rgba(255,136,68,0.3)"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.4, delay: 2 }
          }
        />
      </svg>
  );
}

export function LoadingScreen({ show }: { show: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: reducedMotion ? 0 : 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]"
        >
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.1 }}
          >
            <RouteLoop reducedMotion={reducedMotion} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

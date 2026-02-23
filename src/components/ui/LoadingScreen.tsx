"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* A route-like SVG path that slowly rotates */
const ROUTE_PATH =
  "M 60 140 C 65 120, 80 95, 95 100 C 110 105, 100 130, 115 120 C 135 108, 130 75, 140 60 C 148 48, 155 65, 160 55 C 168 42, 162 28, 175 22 C 185 17, 178 38, 190 30";

function SpinningRoute({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <motion.div
      animate={reducedMotion ? undefined : { rotate: 360 }}
      transition={
        reducedMotion
          ? undefined
          : { duration: 20, repeat: Infinity, ease: "linear" }
      }
    >
      <svg
        width="160"
        height="160"
        viewBox="20 0 200 170"
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

        {/* Start dot */}
        <motion.circle
          cx="60"
          cy="140"
          r="2.5"
          fill="rgba(255,136,68,0.3)"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.4, delay: 0.1 }
          }
        />

        {/* End dot */}
        <motion.circle
          cx="190"
          cy="30"
          r="2.5"
          fill="rgba(0,255,204,0.3)"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.4, delay: 2 }
          }
        />
      </svg>
    </motion.div>
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
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.1 }}
          >
            <SpinningRoute reducedMotion={reducedMotion} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

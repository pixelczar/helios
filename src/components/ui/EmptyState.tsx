"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, useEffect } from "react";

const EASE = [0.25, 0.1, 0.25, 1] as const;
const STAGGER = 0.09;

function item(i: number, reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0 } },
    };
  }
  return {
    initial: { opacity: 0, y: 12, filter: "blur(6px)" },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.6, delay: 0.3 + i * STAGGER, ease: EASE },
    },
  };
}

/* Ghostly route path — draws itself in over ~2.5s */
function RouteSilhouette({ reducedMotion }: { reducedMotion: boolean | null }) {
  const pathD =
    "M 30 130 C 35 110, 55 70, 70 75 C 85 80, 65 115, 90 100 C 115 85, 110 50, 120 40 C 130 30, 140 55, 150 45 C 160 35, 155 20, 170 15";

  return (
    <motion.svg
      {...item(0, reducedMotion)}
      width="200"
      height="145"
      viewBox="0 0 200 145"
      fill="none"
      className="mb-2"
    >
      {/* Soft glow under the path */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="pathGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
        </linearGradient>
      </defs>

      {/* Static faint trace */}
      <path
        d={pathD}
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Animated draw-in */}
      <motion.path
        d={pathD}
        stroke="url(#pathGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#glow)"
        initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 2.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] }
        }
      />

      {/* Start dot */}
      <motion.circle
        cx="30"
        cy="130"
        r="2"
        fill="rgba(255,255,255,0.12)"
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 0.4, delay: 0.3, ease: EASE }
        }
      />

      {/* End dot */}
      <motion.circle
        cx="170"
        cy="15"
        r="2"
        fill="rgba(255,255,255,0.2)"
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 0.4, delay: 2.8, ease: EASE }
        }
      />
    </motion.svg>
  );
}

function useIsDemo() {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(document.cookie.includes("demo_mode=true"));
  }, []);
  return demo;
}

export function EmptyState({ error }: { error: string | null }) {
  const reducedMotion = useReducedMotion();
  const isDemo = useIsDemo();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.5 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#000000]"
    >
      {/* Radial ambient glow */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial="initial"
        animate="animate"
        className="relative z-10 flex flex-col items-center"
      >
        <RouteSilhouette reducedMotion={reducedMotion} />

        <motion.h2
          {...item(1, reducedMotion)}
          className="mt-6 text-[13px] font-light tracking-[0.2em] uppercase text-neutral-400"
        >
          {error ? "Something went wrong" : "No runs found"}
        </motion.h2>

        <motion.p
          {...item(2, reducedMotion)}
          className="mt-3 text-[13px] leading-relaxed text-neutral-600 max-w-[260px] text-center"
        >
          {error
            ? isDemo
              ? "Something went wrong loading the demo data."
              : "We couldn\u2019t load your activities. Check your connection and try again."
            : "This account doesn\u2019t have any running activities on Strava yet."}
        </motion.p>

        <motion.div
          {...item(3, reducedMotion)}
          className="flex items-center gap-3 mt-8"
        >
          {error ? (
            <>
              <button
                onClick={() => window.location.reload()}
                className="group relative px-5 py-2.5 rounded-full text-[12px] tracking-wide text-neutral-300 transition-all duration-300 overflow-hidden"
              >
                <span className="absolute inset-0 rounded-full border border-neutral-700 transition-colors duration-300 group-hover:border-neutral-500" />
                <span className="relative">Try again</span>
              </button>
              <a
                href="/api/auth/logout"
                className="px-5 py-2.5 rounded-full text-[12px] tracking-wide text-neutral-600 transition-colors duration-300 hover:text-neutral-400"
              >
                {isDemo ? "Exit demo" : "Disconnect"}
              </a>
            </>
          ) : (
            <a
              href="/api/auth/logout"
              className="group relative px-5 py-2.5 rounded-full text-[12px] tracking-wide text-neutral-300 transition-all duration-300 overflow-hidden"
            >
              <span className="absolute inset-0 rounded-full border border-neutral-700 transition-colors duration-300 group-hover:border-neutral-500" />
              <span className="relative">
                {isDemo ? "Exit demo" : "Switch account"}
              </span>
            </a>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

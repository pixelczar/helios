"use client";

import { motion, useReducedMotion } from "framer-motion";
import { RouteBackground } from "./RouteBackground";

const STAGGER = 0.06;
const EASE = [0.25, 0.1, 0.25, 1] as const;

function itemVariants(i: number, reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0 } },
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
  };
}

export function LandingPage() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center relative overflow-hidden">
      <RouteBackground />

      <motion.div
        initial="initial"
        animate="animate"
        className="relative z-10 flex flex-col items-center gap-4"
      >
        <div className="flex flex-col gap-8 items-center">
          <motion.h1
            variants={itemVariants(0, reducedMotion)}
            className="text-9xl text-neutral-100 mb-24"
            style={{
              fontStyle: "italic",
              fontWeight: 900,
            }}
          >
            Helios
          </motion.h1>

          {/* <motion.p
            variants={itemVariants(1, reducedMotion)}
            className="text-sm font-light text-neutral-500 tracking-wide"
          >
            Your running journey, visualized
          </motion.p> */}
        </div>

        <motion.a
          variants={itemVariants(2, reducedMotion)}
          href="/api/auth/strava"
          className="group relative flex items-center gap-3 px-8 py-3.5 rounded-full bg-[#FC4C02] text-white font-medium text-sm tracking-wide transition-shadow hover:shadow-[0_0_30px_rgba(252,76,2,0.3)]"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
          >
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Connect with Strava
        </motion.a>

        <motion.a
          variants={itemVariants(3, reducedMotion)}
          href="/api/auth/demo"
          className="flex items-center gap-3 px-8 py-3.5 rounded-full border border-neutral-800 text-neutral-400 font-medium text-sm tracking-wide transition-colors hover:border-neutral-600 hover:text-neutral-200 duration-500"
        >
          View Demo
        </motion.a>

        <motion.p
          variants={itemVariants(4, reducedMotion)}
          className="text-[10px] text-neutral-700 tracking-wide text-center mt-4"
        >
          We only read your activity data. <br></br>Nothing is stored externally.
        </motion.p>
      </motion.div>
    </div>
  );
}

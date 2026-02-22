"use client";

import { motion, useReducedMotion } from "framer-motion";

export function LandingPage() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Subtle gradient backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,255,204,0.03)_0%,_transparent_70%)]" />

      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 30, filter: "blur(6px)" }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: reducedMotion ? 0 : 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 flex flex-col items-center gap-10"
      >
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-extralight tracking-[0.4em] text-neutral-100 uppercase">
            Helios
          </h1>
          <p className="text-sm font-light text-neutral-500 tracking-wide">
            Your runs, visualized in 3D
          </p>
        </div>

        <motion.a
          href="/api/auth/strava"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
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

        <p className="text-[10px] text-neutral-700 tracking-wide">
          We only read your activity data. Nothing is stored externally.
        </p>
      </motion.div>
    </div>
  );
}

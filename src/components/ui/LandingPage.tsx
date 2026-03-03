"use client";

import {
  motion,
  useReducedMotion,
  useMotionValue,
  useMotionTemplate,
  useTransform,
  useAnimationFrame,
} from "framer-motion";
import { useRef } from "react";
import { RouteBackground } from "./RouteBackground";

const BASE_DELAY = 1.4; // let the route draw before revealing UI
const STAGGER = 0.15;
const EASE = [0.16, 1, 0.3, 1] as const;

function itemVariants(i: number, reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0 } },
    };
  }
  return {
    initial: { opacity: 0, filter: "blur(6px)" },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      transition: { duration: 1.4, delay: BASE_DELAY + i * STAGGER, ease: EASE },
    },
  };
}

export function LandingPage() {
  const reducedMotion = useReducedMotion();
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue(0);

  useAnimationFrame((time) => {
    if (reducedMotion) return;
    const length = pathRef.current?.getTotalLength();
    if (length) {
      progress.set((time * (length / 4000)) % length);
    }
  });

  const x = useTransform(progress, (val) =>
    pathRef.current?.getPointAtLength(val)?.x ?? 0
  );
  const y = useTransform(progress, (val) =>
    pathRef.current?.getPointAtLength(val)?.y ?? 0
  );

  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center relative overflow-hidden">
      <RouteBackground />

      <motion.div
        initial="initial"
        animate="animate"
        className="relative z-10 flex flex-col items-center gap-4"
      >
        <div className="flex flex-col gap-8 items-center">
          <motion.img
            variants={itemVariants(0, reducedMotion)}
            src="/helios-greeter.png"
            alt="Helios"
            className="mb-32 h-20 w-auto"
            draggable={false}
          />

          {/* <motion.p
            variants={itemVariants(1, reducedMotion)}
            className="text-sm font-light text-neutral-500 tracking-wide"
          >
            Your running journey, visualized
          </motion.p> */}
        </div>

        <div className="flex flex-col gap-4">
          <motion.a
            variants={itemVariants(2, reducedMotion)}
            href="/api/auth/strava"
            className="group relative flex items-center justify-center gap-3 px-4 py-3 rounded-full bg-[#FC4C02] text-white font-medium text-sm tracking-wide transition-shadow duration-200 hover:shadow-[0_0_30px_rgba(252,76,2,0.3)]"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="currentColor"
            >
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Connect
          </motion.a>

          <motion.div
            variants={itemVariants(3, reducedMotion)}
            className="relative rounded-full p-px overflow-hidden"
          >
            <div className="absolute inset-0 rounded-full bg-white/6" />
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
                className="absolute h-full w-full"
              >
                <rect
                  fill="none"
                  width="100%"
                  height="100%"
                  rx="9999"
                  ry="9999"
                  ref={pathRef}
                />
              </svg>
              <motion.div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform,
                  width: 80,
                  height: 80,
                  background:
                    "radial-gradient(rgba(255,255,255,0.7) 0%, transparent 50%)",
                }}
              />
            </div>
            <a
              href="/api/auth/demo"
              className="relative flex items-center justify-center gap-3 px-4 py-3 rounded-full bg-black text-neutral-400 font-medium text-sm tracking-wide transition-colors hover:text-neutral-200 duration-200"
            >
              Demo
            </a>
          </motion.div>
        </div>
{/* 
        <motion.p
          variants={itemVariants(4, reducedMotion)}
          className="text-[10px] text-neutral-700 tracking-wide text-center mt-4"
        >
          We only read your activity data. <br></br>Nothing is stored externally.
        </motion.p> */}
      </motion.div>
    </div>
  );
}

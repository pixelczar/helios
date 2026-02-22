"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <button
      onClick={toggleTheme}
      className="absolute top-6 right-6 pointer-events-auto w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 hover:border-neutral-600 transition-colors"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <AnimatePresence mode="wait">
        {theme === "dark" ? (
          <motion.svg
            key="moon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-400"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(4px)" }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(4px)" }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", duration: 0.3, bounce: 0 }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </motion.svg>
        ) : (
          <motion.svg
            key="sun"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-400"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(4px)" }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(4px)" }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", duration: 0.3, bounce: 0 }}
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}

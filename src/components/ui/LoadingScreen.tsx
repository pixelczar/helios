"use client";

import { motion, AnimatePresence } from "framer-motion";

export function LoadingScreen({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col items-center gap-6"
          >
            <h1 className="text-2xl font-extralight tracking-[0.3em] text-neutral-200 uppercase">
              Fun Run
            </h1>
            <div className="w-32 h-px bg-neutral-800 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#ff8844] to-[#00ffcc]"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
              Loading your runs
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

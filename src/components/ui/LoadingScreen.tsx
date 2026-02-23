"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* Real Strava route path (from RouteBackground ROUTE_1) — naturally loops back to start */
const ROUTE_PATH =
  "M584.5,124.5 L585.7,139.0 L576.0,148.8 L566.6,147.6 L560.8,140.0 L559.7,134.1 L555.0,131.4 L545.8,133.6 L532.7,131.4 L513.3,132.8 L504.5,130.4 L483.7,155.7 L477.0,158.4 L461.9,153.7 L456.8,155.2 L442.9,174.8 L437.3,178.3 L422.7,177.0 L406.4,170.2 L396.9,174.3 L379.4,205.5 L373.2,210.7 L362.2,214.4 L347.4,276.0 L343.4,285.6 L344.3,290.3 L349.2,295.2 L348.8,304.5 L346.5,309.7 L338.7,315.5 L344.9,321.0 L355.5,320.7 L360.9,327.1 L365.8,342.8 L363.3,367.9 L361.1,369.6 L357.2,368.1 L335.5,352.6 L327.5,359.3 L323.0,361.0 L309.3,354.6 L292.7,367.4 L290.9,371.8 L301.0,378.9 L307.7,395.1 L315.6,401.5 L276.1,407.2 L264.3,399.0 L247.5,392.2 L238.3,380.4 L236.7,370.6 L233.1,366.4 L222.6,365.2 L205.3,367.4 L202.9,372.0 L208.2,392.9 L207.8,413.8 L218.3,420.9 L226.2,429.7 L229.5,446.7 L223.2,454.6 L206.0,458.2 L200.8,461.7 L186.9,476.7 L183.6,484.3 L172.3,490.4 L169.7,498.0 L170.8,520.6 L181.6,532.4 L185.8,543.9 L171.4,603.4 L177.9,617.1 L183.8,615.7 L220.8,631.1 L241.4,630.4 L247.9,634.1 L252.2,640.2 L265.4,644.4 L269.4,640.5 L270.3,631.9 L274.6,631.9 L282.6,636.5 L311.3,642.4 L332.1,656.4 L342.9,641.2 L344.2,625.7 L356.6,609.0 L364.7,606.8 L372.3,609.5 L388.9,605.3 L400.3,595.0 L414.2,574.9 L425.0,572.2 L429.2,574.9 L429.9,578.6 L424.9,593.1 L419.1,601.9 L420.3,610.0 L437.3,627.9 L446.2,634.1 L451.6,643.7 L458.3,674.1 L464.6,678.5 L477.8,669.7 L503.2,661.1 L511.9,648.6 L524.5,635.5 L538.8,629.7 L537.4,614.9 L524.5,601.4 L521.6,583.7 L514.8,578.6 L507.0,564.6 L500.3,558.7 L490.9,555.5 L486.1,550.1 L484.4,544.7 L479.2,540.3 L480.3,526.8 L470.0,513.2 L459.7,506.1 L456.3,500.7 L455.2,486.0 L464.4,472.7 L455.9,455.3 L463.5,423.9 L460.8,414.0 L462.1,403.2 L455.2,390.5 L445.1,382.1 L441.5,357.8 L449.6,351.4 L462.4,350.4 L468.2,352.6 L474.0,362.0 L479.8,362.9 L487.2,360.2 L494.2,351.2 L504.5,346.5 L507.4,342.8 L507.0,328.3 L513.2,307.9 L515.1,289.8 L508.3,249.2 L520.2,246.3 L530.0,232.8 L539.2,229.3 L536.1,214.1 L539.7,212.2 L547.3,216.1 L550.4,215.3 L552.0,201.8 L563.0,207.5 L565.0,194.5 L591.9,176.8 L599.8,178.8 L604.2,190.1 L611.0,192.0 L614.6,190.3 L614.5,185.9 L608.0,179.2 L602.0,161.3 L584.5,142.4 L586.1,130.4 L581.6,120.6 Z";

function RouteLoop({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <svg
      width="160"
      height="160"
      viewBox="120 80 540 640"
      fill="none"
    >
      <defs>
        <filter id="loader-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="loader-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,136,68,0.3)" />
          <stop offset="100%" stopColor="rgba(0,255,204,0.3)" />
        </linearGradient>
      </defs>

      {/* Faint static trace */}
      <path
        d={ROUTE_PATH}
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Animated draw-in */}
      <motion.path
        d={ROUTE_PATH}
        stroke="url(#loader-grad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#loader-glow)"
        initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 2.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }
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

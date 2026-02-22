"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useActivityStore } from "@/stores/activityStore";
import { useGoalStore, calculateYearlyPaceAtDate } from "@/stores/goalStore";
import { getRouteColorHex } from "@/lib/colors";

const AHEAD_COLOR = "#00ffcc";
const BEHIND_COLOR = "#ff8844";
const NEUTRAL_COLOR = "#555555";

function buildMask(progress: number, t: number): string {
  const p = progress * 100;
  const spread = 20 + t * 80;
  const edge = 0.05 + t * 0.65;
  return `linear-gradient(to bottom,rgba(255,255,255,${edge}) 0%,rgba(255,255,255,${edge}) ${Math.max(0, p - spread)}%,rgba(255,255,255,1) ${Math.max(0, p - 5)}%,rgba(255,255,255,1) ${Math.min(100, p + 5)}%,rgba(255,255,255,${edge}) ${Math.min(100, p + spread)}%,rgba(255,255,255,${edge}) 100%)`;
}

// Velocity-aware spring — overshoots then settles
function springLerp(current: number, target: number, velocity: number, stiffness: number, damping: number, dt: number) {
  const displacement = current - target;
  const springForce = -stiffness * displacement;
  const dampingForce = -damping * velocity;
  const acceleration = springForce + dampingForce;
  const newVelocity = velocity + acceleration * dt;
  const newValue = current + newVelocity * dt;
  return { value: newValue, velocity: newVelocity };
}

export function ScrollIndicator() {
  const currentIndex = useActivityStore((s) => s.currentIndex);
  const activities = useActivityStore((s) => s.activities);
  const yearlyTarget = useGoalStore((s) => s.yearlyTarget);
  const reducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const paceTrackRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const dotCoreRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const [hovered, setHovered] = useState(false);

  // Smooth interpolation state
  const hoverTarget = useRef(0);
  const hoverT = useRef(0);
  const smoothProgress = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const rafId = useRef(0);

  // Delayed dot — spring physics
  const delayedProgress = useRef(0);
  const dotVelocity = useRef(0);

  // Ghost trail — even more delayed
  const ghostProgress = useRef(0);
  const ghostVelocity = useRef(0);

  // Trail history for fading wake
  const trailHistory = useRef<{ pos: number; age: number }[]>([]);

  // Pulse phase for breathing glow
  const pulsePhase = useRef(0);

  // Previous scroll progress for delta detection
  const prevScrollProgress = useRef(0);

  const totalRuns = activities.length;
  const discreteProgress = totalRuns > 1 ? currentIndex / (totalRuns - 1) : 0;

  // Day-of-year timeline: top = day 1, bottom = today
  const todayDayOfYear = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  }, []);

  // Day positions for each activity (fractional 0-1 on the year timeline)
  const dayPositionsRef = useRef<number[]>([]);

  useEffect(() => {
    hoverTarget.current = hovered ? 1 : 0;
  }, [hovered]);

  const findScrollContainer = useCallback((): HTMLElement | null => {
    if (scrollContainerRef.current) {
      if (scrollContainerRef.current.isConnected) return scrollContainerRef.current;
      scrollContainerRef.current = null;
    }
    const candidates = document.querySelectorAll("div");
    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflow === "auto" || style.overflow === "scroll" ||
         style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 100
      ) {
        scrollContainerRef.current = el;
        return el;
      }
    }
    return null;
  }, []);

  // rAF loop — gradient is instant, dot trails with spring physics
  useEffect(() => {
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // cap dt to avoid explosion
      lastTime = now;

      // Read continuous scroll progress
      const container = findScrollContainer();
      if (container) {
        const scrollable = container.scrollHeight - container.clientHeight;
        if (scrollable > 0) {
          smoothProgress.current = container.scrollTop / scrollable;
        }
      }

      const scrollProgress = smoothProgress.current;

      // Map scroll progress (activity-linear) to day-based position on year timeline
      const positions = dayPositionsRef.current;
      const numAct = positions.length;
      let progress: number;
      if (numAct > 1) {
        const rawIdx = scrollProgress * (numAct - 1);
        const lo = Math.max(0, Math.min(Math.floor(rawIdx), numAct - 1));
        const hi = Math.min(lo + 1, numAct - 1);
        const frac = rawIdx - lo;
        progress = lo === hi ? positions[lo] : positions[lo] + (positions[hi] - positions[lo]) * frac;
      } else if (numAct === 1) {
        progress = positions[0];
      } else {
        progress = scrollProgress;
      }

      // Detect scroll velocity for dynamic effects
      const scrollDelta = Math.abs(progress - prevScrollProgress.current);
      prevScrollProgress.current = progress;

      // Hover interpolation (frame-rate independent)
      const target = hoverTarget.current;
      const current = hoverT.current;
      const factor = 1 - Math.pow(0.92, dt * 60);
      const next = current + (target - current) * factor;
      hoverT.current = Math.abs(next - target) < 0.001 ? target : next;
      const t = hoverT.current;

      // Spring-based delayed dot — higher damping for less overshoot
      const dotSpring = springLerp(delayedProgress.current, progress, dotVelocity.current, 12, 6, dt);
      delayedProgress.current = dotSpring.value;
      dotVelocity.current = dotSpring.velocity;

      // Ghost trail — softer spring, more lag
      const ghostSpring = springLerp(ghostProgress.current, progress, ghostVelocity.current, 6, 4, dt);
      ghostProgress.current = ghostSpring.value;
      ghostVelocity.current = ghostSpring.velocity;

      // Track trail history — sample when moving
      if (scrollDelta > 0.0005) {
        trailHistory.current.push({ pos: delayedProgress.current, age: 0 });
        if (trailHistory.current.length > 12) trailHistory.current.shift();
      }
      // Age and cull trail
      for (let i = trailHistory.current.length - 1; i >= 0; i--) {
        trailHistory.current[i].age += dt;
        if (trailHistory.current[i].age > 0.4) {
          trailHistory.current.splice(i, 1);
        }
      }

      // Pulse phase for breathing glow (skip when reduced motion)
      if (!reducedMotion) {
        pulsePhase.current += dt * 2.5;
      }

      // Track width + mask — driven by INSTANT scroll progress
      if (paceTrackRef.current) {
        const w = 1.5 + t * 1.5;
        paceTrackRef.current.style.width = `${w}px`;
        const mask = buildMask(progress, t);
        paceTrackRef.current.style.maskImage = mask;
        paceTrackRef.current.style.webkitMaskImage = mask;
      }

      // Dot velocity magnitude for dynamic glow intensity
      const speed = Math.abs(dotVelocity.current);
      const speedBoost = Math.min(speed * 3, 1);

      // Breathing glow — pulses gently at rest, intensifies when moving
      const breathe = Math.sin(pulsePhase.current) * 0.5 + 0.5;
      if (glowRef.current) {
        const baseSize = 24 + t * 10;
        const s = baseSize + speedBoost * 16 + breathe * 4;
        glowRef.current.style.width = `${s}px`;
        glowRef.current.style.height = `${s}px`;
        glowRef.current.style.opacity = `${0.25 + t * 0.2 + speedBoost * 0.35 + breathe * 0.05}`;
      }

      // Dot core — scales up slightly when moving fast
      if (dotCoreRef.current) {
        const scale = 1 + speedBoost * 0.3 + t * 0.15;
        dotCoreRef.current.style.scale = `${scale}`;
      }

      // Dot position — DELAYED, trails the gradient
      if (dotRef.current) {
        dotRef.current.style.top = `${delayedProgress.current * 100}%`;
      }

      // Label position — follows the delayed dot smoothly
      if (labelRef.current) {
        labelRef.current.style.top = `${delayedProgress.current * 100}%`;
      }

      // Ghost — fainter, even more delayed
      if (ghostRef.current) {
        ghostRef.current.style.top = `${ghostProgress.current * 100}%`;
        const ghostOpacity = Math.min(scrollDelta * 400, 0.3) + speed * 0.15;
        ghostRef.current.style.opacity = `${Math.min(ghostOpacity, 0.35)}`;
      }

      // Trail canvas — fading wake particles + activity tick marks
      const canvas = trailCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const h = canvas.height;
          const cx = canvas.width / 2;
          ctx.clearRect(0, 0, canvas.width, h);

          // Activity tick marks — small dots at each activity's day position
          const curIdx = useActivityStore.getState().currentIndex;
          for (let i = 0; i < positions.length; i++) {
            const y = positions[i] * h;
            const isCurrent = i === curIdx;
            ctx.beginPath();
            ctx.arc(cx, y, isCurrent ? 1.5 : 1, 0, Math.PI * 2);
            ctx.fillStyle = isCurrent
              ? "rgba(255, 255, 255, 0.5)"
              : "rgba(255, 255, 255, 0.12)";
            ctx.fill();
          }

          // Trail wake particles
          for (const point of trailHistory.current) {
            const alpha = Math.max(0, 1 - point.age / 0.4) * 0.4;
            const radius = 2 * (1 - point.age / 0.4);
            const y = point.pos * h;
            ctx.beginPath();
            ctx.arc(cx, y, Math.max(0.5, radius), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
          }
        }
      }

      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [findScrollContainer]);

  const paceData = useMemo(() => {
    if (activities.length === 0) {
      dayPositionsRef.current = [];
      return [];
    }
    let cumMiles = 0;
    const data = activities.map((activity) => {
      const date = new Date(activity.start_date_local);
      const { ratio } = calculateYearlyPaceAtDate(activities, yearlyTarget, date);
      cumMiles += activity.distance / 1609.344;
      const startOfYear = new Date(date.getFullYear(), 0, 0);
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
      return { ratio, dayOfYear, cumMiles };
    });
    // Cache day positions (0-1 on year timeline) for the rAF loop
    dayPositionsRef.current = data.map((d) =>
      Math.max(0, Math.min(1, d.dayOfYear / todayDayOfYear))
    );
    // Enforce monotonicity so the tracer never reverses direction.
    // Activities arrive reverse-chronologically from Strava, but backdated
    // entries or same-day runs can break strict ordering.
    const positions = dayPositionsRef.current;
    if (positions.length > 1) {
      if (positions[0] >= positions[positions.length - 1]) {
        for (let i = 1; i < positions.length; i++) {
          positions[i] = Math.min(positions[i], positions[i - 1]);
        }
      } else {
        for (let i = 1; i < positions.length; i++) {
          positions[i] = Math.max(positions[i], positions[i - 1]);
        }
      }
    }
    return data;
  }, [activities, yearlyTarget, todayDayOfYear]);

  const gradientStops = useMemo(() => {
    if (paceData.length === 0) return [];
    return paceData
      .map((d) => {
        const t = Math.max(0, Math.min(1, d.dayOfYear / todayDayOfYear));
        const blend = Math.max(0, Math.min(1, (d.ratio - 0.8) / 0.4));
        return { offset: t, blend };
      })
      .sort((a, b) => a.offset - b.offset);
  }, [paceData, todayDayOfYear]);

  const scrollToProgress = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clickT = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      // Reverse-map: click position (day-based) → closest activity → scroll position
      const positions = dayPositionsRef.current;
      const container = findScrollContainer();
      if (!container || positions.length === 0) return;
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < positions.length; i++) {
        const dist = Math.abs(positions[i] - clickT);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      const scrollT = positions.length > 1 ? closestIdx / (positions.length - 1) : 0;
      const scrollable = container.scrollHeight - container.clientHeight;
      container.scrollTop = scrollT * scrollable;
    },
    [findScrollContainer]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      hoverTarget.current = 1;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      scrollToProgress(e.clientY);
    },
    [scrollToProgress]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      scrollToProgress(e.clientY);
    },
    [scrollToProgress]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    if (!hovered) hoverTarget.current = 0;
  }, [hovered]);

  if (totalRuns === 0) return null;

  const currentColor = paceData[currentIndex]
    ? getRouteColorHex(paceData[currentIndex].ratio)
    : BEHIND_COLOR;

  return (
    <div
      ref={trackRef}
      className="absolute right-4 top-1/2 -translate-y-1/2 h-[30vh] md:h-[40vh] w-6 md:w-8 pointer-events-auto cursor-pointer flex items-center justify-center select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        if (!isDragging.current) hoverTarget.current = 0;
      }}
    >
      {/* Year boundary labels */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-5 text-[9px] font-mono uppercase tracking-widest text-neutral-600 whitespace-nowrap">
        Jan 1
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-5 text-[9px] font-mono uppercase tracking-widest text-neutral-600 whitespace-nowrap">
        Today
      </div>

      {/* Base track — subtle, barely-there line */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[1.5px] h-full bg-white/4 rounded-full" />

      {/* Trail canvas — fading wake particles behind the dot */}
      <canvas
        ref={trailCanvasRef}
        width={8}
        height={400}
        className="absolute left-1/2 -translate-x-1/2 h-full pointer-events-none"
        style={{ width: "8px" }}
      />

      {/* Colored pace track — width + mask interpolated by rAF */}
      <div
        ref={paceTrackRef}
        className="absolute left-1/2 -translate-x-1/2 h-full rounded-full overflow-hidden"
        style={{ width: "1.5px", willChange: "width" }}
      >
        <svg
          width="3"
          height="100%"
          viewBox="0 0 3 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
              {gradientStops.length > 0 ? (
                gradientStops.map((stop, i) => (
                  <stop
                    key={i}
                    offset={`${stop.offset * 100}%`}
                    stopColor={
                      stop.blend > 0.6
                        ? AHEAD_COLOR
                        : stop.blend < 0.4
                          ? BEHIND_COLOR
                          : NEUTRAL_COLOR
                    }
                    stopOpacity={0.9}
                  />
                ))
              ) : (
                <stop offset="0%" stopColor={NEUTRAL_COLOR} />
              )}
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="3" height="100" fill="url(#paceGradient)" />
        </svg>
      </div>

      {/* Ghost dot — the faintest trailing shadow */}
      <div
        ref={ghostRef}
        className="absolute left-1/2 -translate-x-1/2 z-5 pointer-events-none"
        style={{ top: "0%", opacity: 0 }}
      >
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "14px",
            height: "14px",
            background: `radial-gradient(circle, ${currentColor}40 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "4px",
            height: "4px",
            backgroundColor: currentColor,
            opacity: 0.3,
          }}
        />
      </div>

      {/* Label — always visible, position driven by rAF */}
      {paceData[currentIndex] && (
        <div
          ref={labelRef}
          className="absolute right-10 whitespace-nowrap -translate-y-1/2 hidden md:flex items-center gap-2 italic"
          style={{ top: "0%" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center gap-2"
            >
              <motion.span
                variants={{
                  initial: { opacity: 0, y: 6, filter: "blur(3px)" },
                  animate: { opacity: 0.5, y: 0, filter: "blur(0px)", transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
                  exit: { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } },
                }}
                className="text-base font-medium tabular-nums tracking-wide"
              >
                {paceData[currentIndex].dayOfYear}
              </motion.span>
              <motion.span
                variants={{
                  initial: { opacity: 0, y: 6, filter: "blur(3px)" },
                  animate: { opacity: 0.3, y: 0, filter: "blur(0px)", transition: { duration: 0.3, delay: 0.025, ease: [0.25, 0.1, 0.25, 1] } },
                  exit: { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.18, delay: 0.015, ease: [0.25, 0.1, 0.25, 1] } },
                }}
                className="text-sm font-light"
              >
                /
              </motion.span>
              <motion.span
                variants={{
                  initial: { opacity: 0, y: 6, filter: "blur(3px)" },
                  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.3, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] } },
                  exit: { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.18, delay: 0.03, ease: [0.25, 0.1, 0.25, 1] } },
                }}
                className="text-base font-medium tabular-nums tracking-wide"
                style={{
                  color: currentColor,
                  textShadow: `0 0 12px ${currentColor}60`,
                }}
              >
                {paceData[currentIndex].cumMiles.toFixed(1)}mi
              </motion.span>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Primary dot — spring-delayed, trails the gradient */}
      <div
        ref={dotRef}
        className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{ top: "0%" }}
      >
        {/* Outer glow — breathes and flares with motion */}
        <div
          ref={glowRef}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "24px",
            height: "24px",
            opacity: 0.25,
            background: `radial-gradient(circle, ${currentColor} 0%, ${currentColor}40 30%, transparent 70%)`,
            willChange: "width, height, opacity",
          }}
        />
        {/* Inner core — crisp, scales with velocity */}
        <div
          ref={dotCoreRef}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "7px",
            height: "7px",
            backgroundColor: currentColor,
            boxShadow: `0 0 6px ${currentColor}80, 0 0 12px ${currentColor}30`,
            willChange: "transform",
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useActivityStore } from "@/stores/activityStore";
import { useGoalStore, calculateYearlyPaceAtDate } from "@/stores/goalStore";
import { getPaceBandColor } from "@/lib/colors";
import { lockSnap } from "@/lib/scrollLock";
import { INTRO_RUNS } from "@/lib/timeline";
import { dailyPaceDeviation } from "@/lib/pace";

const AHEAD_COLOR = "#00ffcc";
const BEHIND_COLOR = "#ff8844";

// Pace graph — horizontal reach of the deviation curve from the baseline
// (the on-pace line), in CSS px. Ahead grows left toward the content,
// behind grows right toward the screen edge.
const GRAPH_HALF_WIDTH = 22;

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
// The on-pace band is a dim neutral — right for the graph and resting ticks,
// too quiet for the focused run. Focus elements (label, dot, active tick)
// lift it to near-white; ahead/behind keep their colors.
function focusColor(bandColor: string): string {
  return bandColor === "#555555" ? "#f2f2f2" : bandColor;
}

const AHEAD_RGB = hexToRgb(AHEAD_COLOR);
const BEHIND_RGB = hexToRgb(BEHIND_COLOR);

// Sharp falloff for the tick growth — a convex (quartic) curve so only the
// ticks right at the active dot / cursor grow large, dropping off fast as
// you move away. (An ease-in-out curve here read as "samey" near the peak.)
function sharpFalloff(x: number): number {
  const v = Math.max(0, Math.min(1, x));
  return v * v * v * v;
}

// The dot/label/ghost span the full height of the track — clamped only to
// the valid 0-1 range, never inset from the ends. (An earlier inset here
// was making the active dot top out around the middle 93% of the track.)
function clampEdge(p: number): number {
  return Math.min(1, Math.max(0, p));
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
  // Seed the dot a few runs short of Today on first data (matching the 3D
  // intro) instead of springing up from Jan 1 across the whole track
  const dotSeeded = useRef(false);

  // Trail history for fading wake
  const trailHistory = useRef<{ pos: number; age: number }[]>([]);

  // Pulse phase for breathing glow
  const pulsePhase = useRef(0);

  // Previous scroll progress for delta detection
  const prevScrollProgress = useRef(0);

  // Hovered pip — mouse position as 0-1 progress on the track
  const hoveredProgress = useRef<number | null>(null);

  const totalRuns = activities.length;
  const discreteProgress = totalRuns > 1 ? currentIndex / (totalRuns - 1) : 0;

  // Day-of-year timeline. Internally 0 = day 1 (oldest), 1 = today.
  // The track is visually flipped with scaleY(-1) so today renders at the
  // top and the oldest run at the bottom; text labels are counter-flipped.
  const todayDayOfYear = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  }, []);

  // Day positions for each activity (fractional 0-1 on the year timeline)
  const dayPositionsRef = useRef<number[]>([]);
  const ratiosRef = useRef<number[]>([]);
  // Miles ahead (+) / behind (−) of an even pace, indexed by day of year
  const deviationRef = useRef<Float32Array>(new Float32Array(0));
  const maxDeviationRef = useRef(1);
  // Per-tick length spring — a light touch of overshoot as ticks grow/shrink,
  // indexed to match dayPositionsRef; entries are created lazily.
  const tickSpringsRef = useRef<{ value: number; velocity: number }[]>([]);

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
      // Scroll offset: 0 = activity 0, (N-1)/N = activity N-1, 1 = Today
      const positions = dayPositionsRef.current;
      const numAct = positions.length;
      let progress: number;
      if (numAct > 1) {
        // rawIdx maps 0..N where N = Today
        const rawIdx = scrollProgress * numAct;
        if (rawIdx >= numAct) {
          // At or past the Today slot — bottom of year timeline
          progress = 1.0;
        } else {
          const lo = Math.max(0, Math.min(Math.floor(rawIdx), numAct - 1));
          const hi = Math.min(lo + 1, numAct - 1);
          const frac = rawIdx - lo;
          progress = lo === hi ? positions[lo] : positions[lo] + (positions[hi] - positions[lo]) * frac;
        }
      } else if (numAct === 1) {
        progress = scrollProgress >= 0.5 ? 1.0 : positions[0];
      } else {
        progress = scrollProgress;
      }

      if (!dotSeeded.current && numAct > 0) {
        const start = positions[Math.max(0, numAct - INTRO_RUNS)];
        delayedProgress.current = ghostProgress.current = start;
        dotVelocity.current = ghostVelocity.current = 0;
        prevScrollProgress.current = start;
        dotSeeded.current = true;
      }

      // Detect scroll velocity for dynamic effects
      const scrollDelta = Math.abs(progress - prevScrollProgress.current);
      prevScrollProgress.current = progress;

      // Hover interpolation (frame-rate independent) — fast ramp so the
      // hover growth feels immediate, not delayed.
      const target = hoverTarget.current;
      const current = hoverT.current;
      const factor = 1 - Math.pow(0.35, dt * 60);
      const next = current + (target - current) * factor;
      hoverT.current = Math.abs(next - target) < 0.001 ? target : next;
      const t = hoverT.current;

      // Spring-based delayed dot — underdamped for a springy overshoot
      const dotSpring = springLerp(delayedProgress.current, progress, dotVelocity.current, 20, 4.5, dt);
      delayedProgress.current = dotSpring.value;
      dotVelocity.current = dotSpring.velocity;

      // Ghost trail — softer spring, much more lag
      const ghostSpring = springLerp(ghostProgress.current, progress, ghostVelocity.current, 4, 2.5, dt);
      ghostProgress.current = ghostSpring.value;
      ghostVelocity.current = ghostSpring.velocity;

      // Track trail history — sample when moving
      if (scrollDelta > 0.0005) {
        trailHistory.current.push({ pos: delayedProgress.current, age: 0 });
        if (trailHistory.current.length > 24) trailHistory.current.shift();
      }
      // Age and cull trail
      for (let i = trailHistory.current.length - 1; i >= 0; i--) {
        trailHistory.current[i].age += dt;
        if (trailHistory.current[i].age > 0.6) {
          trailHistory.current.splice(i, 1);
        }
      }

      // Pulse phase for breathing glow (skip when reduced motion)
      if (!reducedMotion) {
        pulsePhase.current += dt * 3.5;
      }

      // Dot velocity magnitude for dynamic glow intensity
      const speed = Math.abs(dotVelocity.current);
      const speedBoost = Math.min(speed * 6, 1);

      // Breathing glow — pulses gently at rest, intensifies when moving
      const breathe = Math.sin(pulsePhase.current) * 0.5 + 0.5;
      if (glowRef.current) {
        const baseSize = 28 + t * 22;
        const s = baseSize + speedBoost * 30 + breathe * 8;
        glowRef.current.style.width = `${s}px`;
        glowRef.current.style.height = `${s}px`;
        glowRef.current.style.opacity = `${0.25 + t * 0.25 + speedBoost * 0.45 + breathe * 0.08}`;
      }

      // Dot core — scales up when moving fast
      if (dotCoreRef.current) {
        const scale = 1 + speedBoost * 0.55 + t * 0.25;
        dotCoreRef.current.style.scale = `${scale}`;
      }

      // Dot position — DELAYED, trails the gradient
      if (dotRef.current) {
        dotRef.current.style.top = `${clampEdge(delayedProgress.current) * 100}%`;
      }

      // Label position — follows the delayed dot smoothly
      if (labelRef.current) {
        labelRef.current.style.top = `${clampEdge(delayedProgress.current) * 100}%`;
      }

      // Ghost — fainter, even more delayed
      if (ghostRef.current) {
        ghostRef.current.style.top = `${clampEdge(ghostProgress.current) * 100}%`;
        const ghostOpacity = Math.min(scrollDelta * 400, 0.3) + speed * 0.15;
        ghostRef.current.style.opacity = `${Math.min(ghostOpacity, 0.35)}`;
      }

      // Trail canvas — fading wake particles + activity tick marks
      const canvas = trailCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Scale canvas buffer for retina crispness
          const dpr = window.devicePixelRatio || 1;
          const cssW = 140; // wide enough for ticks to reach either side without clipping
          const cssH = canvas.clientHeight || 400;
          const bufW = Math.round(cssW * dpr);
          const bufH = Math.round(cssH * dpr);
          if (canvas.width !== bufW || canvas.height !== bufH) {
            canvas.width = bufW;
            canvas.height = bufH;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, cssW, cssH);

          // Logical coordinates — draw in CSS pixels
          const h = cssH;
          const cx = cssW / 2;

          // Pace graph — deviation from an even pace over the year. The
          // baseline is the 1:1 line; the area between it and the curve is
          // shaded by sign, fading toward the baseline so near-pace stretches
          // read as quiet and big swings read as saturated.
          const dev = deviationRef.current;
          if (dev.length > 1) {
            const maxAbs = maxDeviationRef.current;
            const days = dev.length - 1;
            const xOf = (v: number) => cx - (v / maxAbs) * GRAPH_HALF_WIDTH;

            const curve = new Path2D();
            const area = new Path2D();
            area.moveTo(cx, 0);
            for (let d = 0; d <= days; d++) {
              const x = xOf(dev[d]);
              const y = (d / days) * h;
              if (d === 0) curve.moveTo(x, y);
              else curve.lineTo(x, y);
              area.lineTo(x, y);
            }
            area.lineTo(cx, h);
            area.closePath();

            const sides: [number, number, string][] = [
              [0, cx, AHEAD_RGB], // ahead — left of the baseline
              [cx, cssW - cx, BEHIND_RGB], // behind — right of it
            ];
            for (const [clipX, clipW, rgb] of sides) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(clipX, 0, clipW, h);
              ctx.clip();
              const edgeX = clipX === 0 ? cx - GRAPH_HALF_WIDTH : cx + GRAPH_HALF_WIDTH;
              const fill = ctx.createLinearGradient(cx, 0, edgeX, 0);
              fill.addColorStop(0, `rgba(${rgb}, 0.02)`);
              fill.addColorStop(1, `rgba(${rgb}, 0.45)`);
              ctx.fillStyle = fill;
              ctx.fill(area);
              ctx.strokeStyle = `rgb(${rgb})`;
              ctx.lineWidth = 1.25;
              ctx.lineJoin = "round";
              ctx.stroke(curve);
              ctx.restore();
            }

            // Focus falloff — full strength around the active dot, dimmer
            // toward the ends (brightens on hover)
            // (the dot travels in the same day-of-year space as the graph)
            const p = clampEdge(delayedProgress.current);
            const edge = 0.35 + t * 0.4;
            const focus = ctx.createLinearGradient(0, 0, 0, h);
            focus.addColorStop(0, `rgba(0,0,0,${edge})`);
            focus.addColorStop(Math.max(0, p - 0.25), `rgba(0,0,0,${edge})`);
            focus.addColorStop(Math.max(0, p - 0.04), "rgba(0,0,0,1)");
            focus.addColorStop(Math.min(1, p + 0.04), "rgba(0,0,0,1)");
            focus.addColorStop(Math.min(1, p + 0.25), `rgba(0,0,0,${edge})`);
            focus.addColorStop(1, `rgba(0,0,0,${edge})`);
            ctx.globalCompositeOperation = "destination-in";
            ctx.fillStyle = focus;
            ctx.fillRect(0, 0, cssW, h);
            ctx.globalCompositeOperation = "source-over";
          }

          // Activity tick marks — horizontal lines that grow near the active dot,
          // and reach out toward the cursor's side when hover-proximate.
          const curIdx = useActivityStore.getState().currentIndex;
          const ratios = ratiosRef.current;
          const dotPos = delayedProgress.current; // spring-delayed position
          const hoverPos = hoveredProgress.current; // mouse position (null when not hovering)
          const anchorX = cx; // center of the track line
          for (let i = 0; i < positions.length; i++) {
            const y = positions[i] * h;
            const isCurrent = i === curIdx;

            // Proximity: how close is this tick to the active dot (0-1, 1 = on
            // top), run through the dramatic ease so the active/traveling dot
            // grows nearby ticks as boldly as hover does.
            const dist = Math.abs(positions[i] - dotPos);
            const proximity = sharpFalloff(Math.max(0, 1 - dist / 0.09));

            // Hover proximity: how close is this tick to the mouse pointer —
            // a wide radius so ticks start reacting well before the cursor is
            // precisely on top of one, with the same dramatic ease-in-out-circ
            // falloff (steep transition, flat extremes).
            const hoverRaw = hoverPos !== null
              ? Math.max(0, 1 - Math.abs(positions[i] - hoverPos) / 0.22)
              : 0;
            const hoverProximity = sharpFalloff(hoverRaw);

            // Combined proximity — take the stronger of active-dot or hover.
            // Both drive the same large growth so a clicked/traveling tick
            // reaches out just as far as a hovered one.
            const effectiveProximity = Math.max(proximity, hoverProximity);

            // Base tick length + proximity growth. Ticks always grow left
            // (toward the label) — never cross to the other side of the line.
            const baseLen = 9 + t * 4;
            const growLen = effectiveProximity * (42 + t * 12);
            const targetLen = baseLen + growLen;

            // Snappy length spring — reaches its target quickly with only a
            // hint of overshoot, so hover growth feels immediate.
            if (!tickSpringsRef.current[i]) {
              tickSpringsRef.current[i] = { value: targetLen, velocity: 0 };
            }
            const tickSpring = tickSpringsRef.current[i];
            const springed = springLerp(tickSpring.value, targetLen, tickSpring.velocity, 320, 26, dt);
            tickSpring.value = springed.value;
            tickSpring.velocity = springed.velocity;
            const tickLen = tickSpring.value;

            // Ticks are run markers — the pace graph carries the color now, so
            // they stay neutral and brighten near the dot/cursor. The current
            // run keeps its pace color to tie the tick to the dot.
            const lineW = isCurrent ? 2.5 : 1 + hoverProximity * 1;
            const color = isCurrent && ratios[i] !== undefined
              ? focusColor(getPaceBandColor(ratios[i]))
              : `rgba(255, 255, 255, ${0.22 + effectiveProximity * 0.5})`;

            ctx.beginPath();
            ctx.moveTo(anchorX, y);
            ctx.lineTo(anchorX - tickLen, y);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineW;
            ctx.lineCap = "butt";
            ctx.stroke();
          }

          // Trail wake particles
          for (const point of trailHistory.current) {
            const alpha = Math.max(0, 1 - point.age / 0.6) * 0.45;
            const radius = 3 * (1 - point.age / 0.6);
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
    ratiosRef.current = data.map((d) => d.ratio);

    // Daily deviation from an even pace — drives the graph
    const { deviation: raw } = dailyPaceDeviation(activities, yearlyTarget, todayDayOfYear);
    // Light smoothing for drawing only — a 5-day triangular kernel rounds
    // off the daily sawtooth without hiding the swings
    const KERNEL = [1, 2, 3, 2, 1];
    const dev = new Float32Array(raw.length);
    let maxAbs = 1;
    for (let d = 0; d < raw.length; d++) {
      let sum = 0;
      let weight = 0;
      for (let k = 0; k < KERNEL.length; k++) {
        const j = d + k - 2;
        if (j < 0 || j >= raw.length) continue;
        sum += raw[j] * KERNEL[k];
        weight += KERNEL[k];
      }
      dev[d] = sum / weight;
      maxAbs = Math.max(maxAbs, Math.abs(dev[d]));
    }
    deviationRef.current = dev;
    maxDeviationRef.current = maxAbs;
    // Enforce monotonicity so the tracer never reverses direction.
    // Activities are sorted chronologically (oldest first), but backdated
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

  const scrollToProgress = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      // Track is flipped (scaleY(-1)): invert screen position to internal 0-1.
      const clickT = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
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
      const scrollT = positions.length > 0 ? closestIdx / positions.length : 0;
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
      // Always track mouse position for pip hover effects
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        // Track is flipped (scaleY(-1)): invert screen position to internal 0-1.
        hoveredProgress.current = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      }
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
    ? focusColor(getPaceBandColor(paceData[currentIndex].ratio))
    : BEHIND_COLOR;

  return (
    <div
      ref={trackRef}
      className="absolute right-6 md:right-10 top-1/2 h-[80vh] w-32 md:w-44 pointer-events-auto cursor-pointer select-none"
      style={{ transform: "translateY(-50%) scaleY(-1)" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        hoveredProgress.current = null;
        if (!isDragging.current) hoverTarget.current = 0;
      }}
    >
      {/* Inner visual track — pinned to the right of the (much wider) hit
          area so the timeline itself stays put while the hover zone extends
          far to the left, making the effect easy to trigger. */}
      <div className="absolute right-0 top-0 h-full w-8">
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          const container = findScrollContainer();
          if (container) {
            lockSnap();
            const scrollable = container.scrollHeight - container.clientHeight;
            // Use instant scroll — the springs in RunTimeline and ScrollIndicator
            // provide smooth visual transitions.
            container.scrollTo({ top: scrollable, behavior: "instant" });
          }
        }}
        style={{ transform: "scaleY(-1)" }}
        className={`absolute left-1/2 -translate-x-1/2 -bottom-9 pl-[0.1em] text-[11px] leading-none font-mono uppercase tracking-widest whitespace-nowrap transition-colors duration-200 cursor-pointer ${
          currentIndex >= totalRuns
            ? "text-neutral-200"
            : "text-neutral-600 hover:text-neutral-400"
        }`}
      >
        {/* Centered over the line; pl offsets tracking's trailing space.
            The main dot sits right below at the track's end, so no extra pip. */}
        Today
      </button>

      {/* Baseline — the 1:1 "on pace" line the graph swings around */}
      <div className="absolute left-1/2 -translate-x-1/2 w-px h-full bg-white/15 z-0" />

      {/* Trail canvas — fading wake particles behind the dot */}
      <canvas
        ref={trailCanvasRef}
        className="absolute left-1/2 -translate-x-1/2 h-full pointer-events-none z-2"
        style={{ width: "140px" }}
      />

      {/* Ghost dot — the faintest trailing shadow */}
      <div
        ref={ghostRef}
        className="absolute left-1/2 -translate-x-1/2 z-3 pointer-events-none"
        style={{ top: "0%", opacity: 0 }}
      >
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "26px",
            height: "26px",
            background: `radial-gradient(circle, ${currentColor}40 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "6px",
            height: "6px",
            backgroundColor: currentColor,
            opacity: 0.3,
          }}
        />
      </div>

      {/* Label — always visible, position driven by rAF */}
      {paceData[currentIndex] && (
        <div
          ref={labelRef}
          className="absolute right-16 md:right-24 whitespace-nowrap hidden md:flex items-center gap-2 italic"
          style={{ top: "0%", transform: "translateY(-50%) scaleY(-1)" }}
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
                  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
                  exit: { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } },
                }}
                className="text-base font-medium tabular-nums tracking-wide"
                style={{
                  color: currentColor,
                  textShadow: `0 0 12px ${currentColor}50`,
                }}
              >
                Day {paceData[currentIndex].dayOfYear}
              </motion.span>
              <motion.span
                variants={{
                  initial: { opacity: 0, y: 6, filter: "blur(3px)" },
                  animate: { opacity: 0.5, y: 0, filter: "blur(0px)", transition: { duration: 0.3, delay: 0.025, ease: [0.25, 0.1, 0.25, 1] } },
                  exit: { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } },
                }}
                className="text-sm font-light"
              >
                /
              </motion.span>
              <motion.span
                variants={{
                  initial: { opacity: 0, y: 6, filter: "blur(3px)" },
                  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.3, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] } },
                  exit: { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } },
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
            width: "28px",
            height: "28px",
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
            width: "9px",
            height: "9px",
            backgroundColor: currentColor,
            boxShadow: `0 0 6px ${currentColor}80, 0 0 12px ${currentColor}30`,
            willChange: "transform",
          }}
        />
      </div>
      </div>
    </div>
  );
}

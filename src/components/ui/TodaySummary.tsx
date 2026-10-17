"use client";

import { useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useActivityStore } from "@/stores/activityStore";
import {
  useGoalStore,
  calculateGoalProgress,
  calculateYearlyPaceAtDate,
} from "@/stores/goalStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { lockSnap } from "@/lib/scrollLock";
import { RouteHeatmap, type HeatmapRoute } from "./RouteHeatmap";
import { formatDistance } from "@/lib/format";
import { getPaceBandColor } from "@/lib/colors";
import { useActivityPhotos } from "@/hooks/useActivityPhotos";
import type { StravaActivity } from "@/lib/strava/types";

const STAGGER = 0.06;
const EASE = [0.25, 0.1, 0.25, 1] as const;

const AHEAD_COLOR = "#00ffcc";
const BEHIND_COLOR = "#ff8844";

function itemVariants(i: number, reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    };
  }
  return {
    initial: { opacity: 0, y: 14 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, delay: i * STAGGER, ease: EASE },
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: { duration: 0.3, delay: i * 0.03, ease: EASE },
    },
  };
}

// Recent-run tiles: a long pause after everything else has settled, then a
// heavy-overlap cascade — each tile's delay increment (0.14s) is much
// shorter than its own animation (0.75s), so they visibly pile onto one
// another rather than finishing one at a time.
function tileVariants(i: number, reducedMotion: boolean | null) {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0 } },
    };
  }
  return {
    initial: { opacity: 0, y: 26, scale: 0.94 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.75, delay: 1.1 + i * 0.14, ease: EASE },
    },
  };
}

export function TodaySummary() {
  const reducedMotion = useReducedMotion();
  const activities = useActivityStore((s) => s.activities);
  const yearlyTarget = useGoalStore((s) => s.yearlyTarget);
  const goals = useGoalStore((s) => s.goals);
  const hiddenGoalIds = useSettingsStore((s) => s.hiddenGoalIds);

  const todayData = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor(
      (now.getTime() - startOfYear.getTime()) / 86400000
    );

    const dateLabel = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const { actual, expected, delta, ratio } = calculateYearlyPaceAtDate(
      activities,
      yearlyTarget,
      now
    );

    const todayStr = now.toISOString().slice(0, 10);
    const todaysRuns = activities.filter(
      (a) => a.start_date_local.slice(0, 10) === todayStr
    );

    return {
      dayOfYear,
      dateLabel,
      totalMiles: actual,
      expectedMiles: expected,
      delta,
      ratio,
      todaysRuns,
      isAhead: delta >= 0,
    };
  }, [activities, yearlyTarget]);

  const deltaColor = todayData.isAhead ? AHEAD_COLOR : BEHIND_COLOR;

  const visibleGoals = useMemo(
    () => goals.filter((g) => !hiddenGoalIds.includes(g.id)),
    [goals, hiddenGoalIds]
  );

  const progresses = useMemo(
    () =>
      visibleGoals.map((g) => calculateGoalProgress(g, activities, new Date())),
    [visibleGoals, activities]
  );

  // Most recent 3 runs, newest first — activities are stored oldest-first.
  const recentRuns = useMemo(() => activities.slice(-3).reverse(), [activities]);
  const recentRunRatios = useMemo(
    () =>
      recentRuns.map(
        (run) =>
          calculateYearlyPaceAtDate(activities, yearlyTarget, new Date(run.start_date_local))
            .ratio
      ),
    [recentRuns, activities, yearlyTarget]
  );

  // Route heatmap backdrop — every run this year, in its pace color
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);
  const heatmapRoutes = useMemo<HeatmapRoute[]>(() => {
    const year = new Date().getFullYear();
    return activities.flatMap((a) => {
      const date = new Date(a.start_date_local);
      const route = decodedRoutes.get(a.id);
      if (date.getFullYear() !== year || !route || route.points.length < 2) return [];
      const { ratio } = calculateYearlyPaceAtDate(activities, yearlyTarget, date);
      return [{ id: a.id, points: route.points, color: getPaceBandColor(ratio) }];
    });
  }, [activities, decodedRoutes, yearlyTarget]);

  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Jump the timeline to a run (same mechanism as the indicator's Today link)
  const jumpToRun = (runId: number) => {
    const index = activities.findIndex((a) => a.id === runId);
    const container = Array.from(document.querySelectorAll("div")).find((el) => {
      const style = window.getComputedStyle(el);
      return (style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 100;
    });
    if (index < 0 || !container || activities.length === 0) return;
    lockSnap();
    const scrollable = container.scrollHeight - container.clientHeight;
    container.scrollTo({ top: (index / activities.length) * scrollable, behavior: "smooth" });
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 z-5 flex items-center justify-center pointer-events-none"
    >
      <RouteHeatmap
        routes={heatmapRoutes}
        highlightId={highlightId}
        reducedMotion={reducedMotion}
      />

      {/* Headline stats — pinned to the top band, above the map */}
      <div className="absolute top-[7vh] inset-x-0 z-10 px-4 flex flex-col items-center">
        {/* Date */}
        <motion.p
          variants={itemVariants(0, reducedMotion)}
          className="text-sm font-mono uppercase tracking-[0.2em] text-neutral-500 mb-6"
        >
          {todayData.dateLabel}
        </motion.p>

        {/* Hero metric lockup — two right-aligned columns with labels */}
        <motion.div
          variants={itemVariants(1, reducedMotion)}
          className="flex items-end gap-8 italic"
        >
          {/* Day of year column */}
          <div className="flex flex-col items-end gap-2">
            <span className="text-6xl md:text-8xl font-black tracking-tighter text-neutral-400 leading-none">
              {todayData.dayOfYear}
            </span>
            <span className="text-sm font-mono uppercase tracking-[0.2em] text-neutral-500 mt-1 not-italic">
              Days
            </span>
          </div>

          {/* Separator */}
          <span className="text-3xl md:text-4xl font-light text-neutral-700 mb-12">
            /
          </span>

          {/* Total miles column */}
          <div className="flex flex-col items-end gap-2">
            <span
              className="text-6xl md:text-8xl font-black tracking-tighter leading-none"
              style={{
                color: deltaColor,
                textShadow: `0 0 40px ${deltaColor}20`,
              }}
            >
              {todayData.totalMiles.toFixed(1)}
            </span>
            <span className="text-sm font-mono uppercase tracking-[0.2em] text-neutral-500 mt-1 not-italic">
              Total Miles
            </span>
          </div>
        </motion.div>

        {/* Pace delta — centered, spaced below */}
        <motion.p
          variants={itemVariants(2, reducedMotion)}
          className="text-base md:text-lg italic font-sans mt-10 text-center"
          style={{ color: deltaColor }}
        >
          {todayData.isAhead ? "+" : ""}
          {todayData.delta.toFixed(1)} mi{" "}
          {todayData.isAhead ? "ahead" : "behind"}
        </motion.p>

        {/* Goal rings */}
        {progresses.length > 0 && (
          <motion.div
            variants={itemVariants(3, reducedMotion)}
            className="flex items-center gap-5 mt-8"
          >
            {progresses.map((p) => (
              <TodayGoalRing key={p.goal.id} progress={p} />
            ))}
          </motion.div>
        )}

        {/* Today's run(s) */}
        {todayData.todaysRuns.length > 0 && (
          <motion.div
            variants={itemVariants(4, reducedMotion)}
            className="mt-10 text-center"
          >
            <p className="text-[11px] font-mono uppercase tracking-widest text-neutral-600 mb-2">
              Today
            </p>
            {todayData.todaysRuns.map((run) => (
              <p
                key={run.id}
                className="text-sm italic text-neutral-400 font-sans"
              >
                {run.name}{" "}
                <span className="text-neutral-600 mx-1">&middot;</span>{" "}
                {formatDistance(run.distance)} mi
              </p>
            ))}
          </motion.div>
        )}

      </div>

      {/* Recent runs — a quiet ledger along the bottom, pinned to the graph */}
      {recentRuns.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center">
          {recentRuns.map((run, i) => (
            <motion.div
              key={run.id}
              variants={tileVariants(i, reducedMotion)}
              className="flex items-center"
            >
              {i > 0 && <span className="w-px h-16 bg-white/10" aria-hidden="true" />}
              <RecentRunItem
                run={run}
                ratio={recentRunRatios[i]}
                index={i}
                reducedMotion={reducedMotion}
                highlighted={highlightId === run.id}
                onHover={(on) => setHighlightId(on ? run.id : null)}
                onSelect={() => jumpToRun(run.id)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function RecentRunItem({
  run,
  ratio,
  index,
  reducedMotion,
  highlighted,
  onHover,
  onSelect,
}: {
  run: StravaActivity;
  ratio: number;
  index: number;
  reducedMotion: boolean | null;
  highlighted: boolean;
  onHover: (on: boolean) => void;
  onSelect: () => void;
}) {
  const color = getPaceBandColor(ratio);
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);
  const route = decodedRoutes.get(run.id);
  const { photos } = useActivityPhotos(run.id, run.total_photo_count);
  const thumb = photos[0];
  const [photoHover, setPhotoHover] = useState(false);
  const thumbUrl = thumb ? thumb.urls?.["600"] || Object.values(thumb.urls)[0] : null;

  const dateLabel = new Date(run.start_date_local).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <button
      type="button"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onClick={onSelect}
      className={`pointer-events-auto flex items-center gap-4 px-5 py-1 cursor-pointer transition-opacity duration-300 outline-none ${
        highlighted ? "opacity-100" : "opacity-70 hover:opacity-100"
      }`}
    >
      <div className="w-24 h-24 shrink-0">
        {route && route.normalized.length > 1 && (
          <CardRouteTrace
            points={route.normalized.map(([x, y]) => `${x},${-y}`).join(" ")}
            color={color}
            drawDelay={1.2 + index * 0.14}
            reducedMotion={reducedMotion}
            className="w-full h-full"
          />
        )}
      </div>

      <div className="flex flex-col items-start gap-2.5">
        <span className="text-5xl font-black italic tracking-tighter text-foreground leading-none tabular-nums">
          {formatDistance(run.distance)}
          <span className="text-sm text-neutral-500 ml-1.5 font-normal not-italic tracking-wide">mi</span>
        </span>
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-500 leading-none">
          {dateLabel}
        </span>
      </div>

      {thumbUrl && (
        <span
          className="relative shrink-0"
          onMouseEnter={() => {
            setPhotoHover(true);
            onHover(true); // full-strength item (the preview inherits its opacity) + map highlight
          }}
          onMouseLeave={() => setPhotoHover(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            className={`w-14 h-14 rounded-lg object-cover transition-[filter] duration-300 ${
              highlighted ? "saturate-100 brightness-100" : "saturate-[0.6] brightness-75"
            }`}
          />
          {/* Large preview — rises from the thumbnail, like the photo pins */}
          <motion.span
            className="absolute left-1/2 bottom-full mb-4 w-72 aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-900 shadow-[0_16px_48px_rgba(0,0,0,0.7)] pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:ring-1 after:ring-inset after:ring-white/15"
            style={{ x: "-50%", transformOrigin: "50% 100%" }}
            initial={false}
            animate={
              photoHover
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 6, scale: 0.94 }
            }
            transition={{ duration: photoHover ? 0.28 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl} alt="" className="w-full h-full object-cover" draggable={false} />
          </motion.span>
        </span>
      )}
    </button>
  );
}

// A route glyph: the full route drawn in faintly, plus a bright short
// segment that continuously loops around it — the "tracer" effect. Uses
// framer-motion's normalized pathLength/pathSpacing/pathOffset so no manual
// getTotalLength math is needed.
function CardRouteTrace({
  points,
  color,
  drawDelay,
  reducedMotion,
  className = "w-full h-28 md:h-32",
}: {
  points: string;
  color: string;
  drawDelay: number;
  reducedMotion: boolean | null;
  className?: string;
}) {
  const shared = {
    points,
    fill: "none" as const,
    stroke: color,
    strokeWidth: 0.11,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      viewBox="-2.9 -2.9 5.8 5.8"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      {/* Base route — draws itself in once, then holds (visible enough to
          read the shape, still quieter than the tracer) */}
      <motion.polyline
        {...shared}
        opacity={0.6}
        initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: reducedMotion ? 0 : 1.4,
          delay: reducedMotion ? 0 : drawDelay,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      />

      {/* Tracer — a bright short segment looping around the route */}
      {!reducedMotion && (
        <motion.polyline
          {...shared}
          strokeWidth={0.22}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
          initial={{ pathLength: 0.08, pathSpacing: 1, pathOffset: 0 }}
          animate={{ pathOffset: [0, 1] }}
          transition={{
            pathOffset: {
              duration: 2.6,
              repeat: Infinity,
              ease: "linear",
              delay: drawDelay + 1.2,
            },
          }}
        />
      )}
    </svg>
  );
}

function TodayGoalRing({
  progress,
}: {
  progress: ReturnType<typeof calculateGoalProgress>;
}) {
  const { goal, current, percentage } = progress;
  const reducedMotion = useReducedMotion();
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const gradientId = `todayGoalGrad-${goal.id}`;

  const label = goal.type.startsWith("weekly") ? "wk" : "mo";
  const isDistance = goal.type.endsWith("distance");
  const displayValue = isDistance
    ? current.toFixed(1)
    : String(Math.round(current));
  const unit = isDistance ? "mi" : "";

  return (
    <div className="relative w-12 h-12 flex flex-col items-center">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-neutral-800"
        />
        <motion.circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", damping: 20, stiffness: 100 }
          }
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff8844" />
            <stop offset="100%" stopColor="#00ffcc" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-medium text-neutral-300 tabular-nums">
          {displayValue}
        </span>
      </span>
      <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-600 mt-1">
        {label}
        {unit && <span className="text-neutral-700 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

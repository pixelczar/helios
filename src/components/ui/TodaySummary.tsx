"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useActivityStore } from "@/stores/activityStore";
import {
  useGoalStore,
  calculateGoalProgress,
  calculateYearlyPaceAtDate,
} from "@/stores/goalStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { fetchMapImage } from "@/lib/geo/mapTiles";
import { formatDistance } from "@/lib/format";

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
    initial: { opacity: 0, y: 14, filter: "blur(4px)" },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.45, delay: i * STAGGER, ease: EASE },
    },
    exit: {
      opacity: 0,
      y: -10,
      filter: "blur(4px)",
      transition: { duration: 0.3, delay: i * 0.03, ease: EASE },
    },
  };
}

export function TodaySummary() {
  const reducedMotion = useReducedMotion();
  const activities = useActivityStore((s) => s.activities);
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);
  const yearlyTarget = useGoalStore((s) => s.yearlyTarget);
  const goals = useGoalStore((s) => s.goals);
  const hiddenGoalIds = useSettingsStore((s) => s.hiddenGoalIds);

  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const mapUrlRef = useRef<string | null>(null);

  // Fetch map tiles from most recent activity with a polyline
  useEffect(() => {
    const activity = activities.find((a) => a.map.summary_polyline);
    if (!activity) return;

    const route = decodedRoutes.get(activity.id);
    if (!route) return;

    let cancelled = false;
    fetchMapImage(activity.id, route.points).then((result) => {
      if (cancelled || !result) return;
      result.canvas.toBlob((blob) => {
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        mapUrlRef.current = url;
        setMapUrl(url);
      });
    });

    return () => {
      cancelled = true;
      if (mapUrlRef.current) {
        URL.revokeObjectURL(mapUrlRef.current);
        mapUrlRef.current = null;
      }
    };
  }, [activities, decodedRoutes]);

  const todayData = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor(
      (now.getTime() - startOfYear.getTime()) / 86400000
    );

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

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 z-[5] flex items-center justify-center"
    >
      {/* Map background layer */}
      <div className="absolute inset-0" aria-hidden="true">
        {mapUrl && (
          <motion.div
            initial={reducedMotion ? { opacity: 0.12 } : { opacity: 0, scale: 1.05 }}
            animate={reducedMotion ? { opacity: 0.12 } : { opacity: 0.12, scale: 1 }}
            transition={{ duration: 2, ease: EASE }}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${mapUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(1px) saturate(0.5)",
            }}
          />
        )}
        {/* Edge vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, black 75%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        {/* "DAY" label */}
        <motion.p
          variants={itemVariants(0, reducedMotion)}
          className="text-[12px] font-mono uppercase tracking-[0.2em] text-neutral-500 mb-4"
        >
          Day
        </motion.p>

        {/* Day of year — hero number */}
        <motion.p
          variants={itemVariants(1, reducedMotion)}
          className="text-6xl md:text-9xl font-black italic text-foreground tracking-tighter"
        >
          {todayData.dayOfYear}
        </motion.p>

        {/* Divider */}
        <motion.div
          variants={itemVariants(2, reducedMotion)}
          className="flex items-center justify-center my-3"
        >
          <div className="w-8 h-px bg-neutral-800" />
        </motion.div>

        {/* Total yearly miles — hero number, colored */}
        <motion.p
          variants={itemVariants(3, reducedMotion)}
          className="text-5xl md:text-8xl font-black italic tracking-tighter"
          style={{
            color: deltaColor,
            textShadow: `0 0 40px ${deltaColor}20`,
          }}
        >
          {todayData.totalMiles.toFixed(1)}
          <span className="text-base text-neutral-500 ml-2 font-normal tracking-normal italic">
            mi
          </span>
        </motion.p>

        {/* Pace delta */}
        <motion.p
          variants={itemVariants(4, reducedMotion)}
          className="text-base md:text-xl italic font-sans mt-4"
          style={{ color: deltaColor }}
        >
          {todayData.isAhead ? "+" : ""}
          {todayData.delta.toFixed(1)} mi{" "}
          {todayData.isAhead ? "ahead" : "behind"}
        </motion.p>

        {/* Goal rings */}
        {progresses.length > 0 && (
          <motion.div
            variants={itemVariants(5, reducedMotion)}
            className="flex items-center justify-center gap-5 mt-8"
          >
            {progresses.map((p) => (
              <TodayGoalRing key={p.goal.id} progress={p} />
            ))}
          </motion.div>
        )}

        {/* Today's run(s) */}
        {todayData.todaysRuns.length > 0 && (
          <motion.div
            variants={itemVariants(6, reducedMotion)}
            className="mt-10"
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
    </motion.div>
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
        {unit && (
          <span className="text-neutral-700 ml-0.5">{unit}</span>
        )}
      </span>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  useGoalStore,
  calculateGoalProgress,
  type GoalType,
} from "@/stores/goalStore";
import { useActivityStore } from "@/stores/activityStore";
import { useScrollIndex } from "@/hooks/useScrollIndex";

const GOAL_LABELS: Record<GoalType, string> = {
  weekly_distance: "Week mi",
  monthly_distance: "Month mi",
  weekly_runs: "Week runs",
  monthly_runs: "Month runs",
};

export function GoalsPanel() {
  const goals = useGoalStore((s) => s.goals);
  const activities = useActivityStore((s) => s.activities);
  const { currentActivity } = useScrollIndex();

  // Time-aware: calculate progress as of the current run's date
  const asOfDate = useMemo(() => {
    if (currentActivity) return new Date(currentActivity.start_date_local);
    return new Date();
  }, [currentActivity]);

  const progresses = useMemo(
    () => goals.map((g) => calculateGoalProgress(g, activities, asOfDate)),
    [goals, activities, asOfDate]
  );

  if (goals.length === 0) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto">
      <div className="bg-neutral-950/80 backdrop-blur-xl border border-white/6 rounded-full px-4 py-2.5 flex items-center gap-4">
        {progresses.map((p) => (
          <GoalRing key={p.goal.id} progress={p} />
        ))}
      </div>
    </div>
  );
}

function GoalRing({
  progress,
}: {
  progress: ReturnType<typeof calculateGoalProgress>;
}) {
  const { goal, current, percentage } = progress;
  const reducedMotion = useReducedMotion();
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const gradientId = `goalPanelGrad-${goal.id}`;

  const displayValue = goal.type.endsWith("distance")
    ? current.toFixed(1)
    : String(Math.round(current));

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-8 h-8">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-neutral-800"
          />
          {/* Progress */}
          <motion.circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", damping: 20, stiffness: 100 }}
          />
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff8844" />
              <stop offset="100%" stopColor="#00ffcc" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-neutral-300 tabular-nums">
          {displayValue}
        </span>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-neutral-600 leading-tight">
          {GOAL_LABELS[goal.type]}
        </p>
        <p className="text-[10px] text-neutral-500 tabular-nums">
          / {goal.target}
        </p>
      </div>
    </div>
  );
}

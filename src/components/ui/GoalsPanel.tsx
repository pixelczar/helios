"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  useGoalStore,
  calculateGoalProgress,
  type GoalType,
} from "@/stores/goalStore";
import { useActivityStore } from "@/stores/activityStore";
import { useScrollIndex } from "@/hooks/useScrollIndex";

const GOAL_LABELS: Record<GoalType, string> = {
  weekly_distance: "Week km",
  monthly_distance: "Month km",
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
    <div className="absolute top-16 right-6 pointer-events-auto flex flex-col gap-3">
      {progresses.map((p) => (
        <GoalRing key={p.goal.id} progress={p} />
      ))}
    </div>
  );
}

function GoalRing({
  progress,
}: {
  progress: ReturnType<typeof calculateGoalProgress>;
}) {
  const { goal, current, percentage } = progress;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const displayValue = goal.type.endsWith("distance")
    ? current.toFixed(1)
    : String(Math.round(current));

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-11 h-11">
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-neutral-800"
          />
          {/* Progress */}
          <motion.circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="url(#goalGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
          />
          <defs>
            <linearGradient id="goalGradient" x1="0" y1="0" x2="1" y2="1">
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
        <p className="text-[8px] uppercase tracking-[0.15em] text-neutral-600 leading-tight">
          {GOAL_LABELS[goal.type]}
        </p>
        <p className="text-[10px] text-neutral-500 tabular-nums">
          / {goal.target}
        </p>
      </div>
    </div>
  );
}

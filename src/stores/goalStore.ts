"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StravaActivity } from "@/lib/strava/types";

export type GoalType =
  | "weekly_distance"
  | "monthly_distance"
  | "weekly_runs"
  | "monthly_runs";

export interface Goal {
  id: string;
  type: GoalType;
  target: number; // km for distance, count for runs
}

export interface GoalProgress {
  goal: Goal;
  current: number;
  percentage: number;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function calculateGoalProgress(
  goal: Goal,
  activities: StravaActivity[],
  asOfDate: Date = new Date()
): GoalProgress {
  const periodStart = goal.type.startsWith("weekly")
    ? getWeekStart(asOfDate)
    : getMonthStart(asOfDate);

  const periodActivities = activities.filter((a) => {
    const d = new Date(a.start_date_local);
    return d >= periodStart && d <= asOfDate;
  });

  let current: number;
  if (goal.type.endsWith("distance")) {
    current =
      periodActivities.reduce((sum, a) => sum + a.distance, 0) / 1000;
  } else {
    current = periodActivities.length;
  }

  return {
    goal,
    current,
    percentage: Math.min(100, (current / goal.target) * 100),
  };
}

interface GoalState {
  goals: Goal[];
  addGoal: (type: GoalType, target: number) => void;
  removeGoal: (id: string) => void;
  updateGoal: (id: string, target: number) => void;
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set) => ({
      goals: [
        { id: "default-weekly-dist", type: "weekly_distance", target: 30 },
        { id: "default-weekly-runs", type: "weekly_runs", target: 4 },
      ],

      addGoal: (type, target) =>
        set((state) => ({
          goals: [
            ...state.goals,
            { id: crypto.randomUUID(), type, target },
          ],
        })),

      removeGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        })),

      updateGoal: (id, target) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, target } : g
          ),
        })),
    }),
    { name: "fun-run-goals" }
  )
);

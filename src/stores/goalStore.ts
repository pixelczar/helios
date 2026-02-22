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
  target: number; // miles for distance, count for runs
}

export interface GoalProgress {
  goal: Goal;
  current: number;
  percentage: number;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
      periodActivities.reduce((sum, a) => sum + a.distance, 0) * 0.000621371;
  } else {
    current = periodActivities.length;
  }

  return {
    goal,
    current,
    percentage: Math.min(100, (current / goal.target) * 100),
  };
}

// Yearly pace calculation for the scroll indicator
export function calculateYearlyPaceAtDate(
  activities: StravaActivity[],
  yearlyTarget: number,
  atDate: Date
): { actual: number; expected: number; delta: number; ratio: number } {
  const yearStart = new Date(atDate.getFullYear(), 0, 1);
  const yearEnd = new Date(atDate.getFullYear(), 11, 31);
  const totalDays =
    (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
  const dayOfYear =
    (atDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

  const expected = (yearlyTarget * dayOfYear) / totalDays;
  const actual =
    activities
      .filter((a) => {
        const d = new Date(a.start_date_local);
        return d.getFullYear() === atDate.getFullYear() && d <= atDate;
      })
      .reduce((sum, a) => sum + a.distance, 0) * 0.000621371;

  const delta = actual - expected;
  // ratio > 1 = ahead, < 1 = behind, 1 = on pace
  const ratio = expected > 0 ? actual / expected : 1;

  return { actual, expected, delta, ratio };
}

interface GoalState {
  goals: Goal[];
  yearlyTarget: number; // miles
  addGoal: (type: GoalType, target: number) => void;
  removeGoal: (id: string) => void;
  updateGoal: (id: string, target: number) => void;
  setYearlyTarget: (target: number) => void;
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set) => ({
      goals: [
        { id: "default-weekly-dist", type: "weekly_distance", target: 20 },
        { id: "default-weekly-runs", type: "weekly_runs", target: 4 },
      ],
      yearlyTarget: 366,

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

      setYearlyTarget: (target) => set({ yearlyTarget: target }),
    }),
    { name: "helios-goals", version: 3 }
  )
);

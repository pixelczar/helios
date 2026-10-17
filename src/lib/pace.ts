import type { StravaActivity } from "@/lib/strava/types";

const METERS_PER_MILE = 1609.344;

export function dayOfYear(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
}

export function daysInYear(year: number): number {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
}

/**
 * Daily deviation from an even pace this year: cumulative miles by the end
 * of day d minus the target's straight-line share (same math as
 * calculateYearlyPaceAtDate). Steps up on run days, drifts down between.
 * Indexed by day of year (0 … throughDay); maxAbs is at least 1.
 */
export function dailyPaceDeviation(
  activities: StravaActivity[],
  yearlyTarget: number,
  throughDay: number,
  year = new Date().getFullYear()
): { deviation: Float32Array; maxAbs: number } {
  const total = daysInYear(year);
  const milesByDay = new Float32Array(throughDay + 1);
  for (const activity of activities) {
    const date = new Date(activity.start_date_local);
    const day = dayOfYear(date);
    if (date.getFullYear() === year && day >= 0 && day <= throughDay) {
      milesByDay[day] += activity.distance / METERS_PER_MILE;
    }
  }

  const deviation = new Float32Array(throughDay + 1);
  let cum = 0;
  let maxAbs = 1;
  for (let day = 0; day <= throughDay; day++) {
    cum += milesByDay[day];
    deviation[day] = cum - (yearlyTarget * day) / total;
    maxAbs = Math.max(maxAbs, Math.abs(deviation[day]));
  }
  return { deviation, maxAbs };
}

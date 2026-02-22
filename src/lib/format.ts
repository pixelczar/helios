const METERS_TO_MILES = 0.000621371;
const METERS_TO_FEET = 3.28084;

export function formatDistance(meters: number): string {
  const miles = meters * METERS_TO_MILES;
  return miles >= 10 ? miles.toFixed(1) : miles.toFixed(2);
}

export function formatPace(avgSpeedMs: number): string {
  if (avgSpeedMs <= 0) return "--:--";
  // seconds per mile
  const paceSecondsPerMile = 1609.344 / avgSpeedMs;
  const minutes = Math.floor(paceSecondsPerMile / 60);
  const seconds = Math.round(paceSecondsPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatElevation(meters: number): string {
  const feet = meters * METERS_TO_FEET;
  return feet.toFixed(0);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

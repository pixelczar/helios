"use client";

// TimeRange type — used by AppPage and RunCounter island
const TIME_RANGE_OPTIONS = [
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
] as const;

export type TimeRange = (typeof TIME_RANGE_OPTIONS)[number]["value"];

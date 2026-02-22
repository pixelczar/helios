"use client";

import { useRef, useMemo, useCallback } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RunCard } from "./RunCard";
import { useActivityStore } from "@/stores/activityStore";
import { useGoalStore, calculateYearlyPaceAtDate } from "@/stores/goalStore";

const RUN_SPACING = 20;

export function RunTimeline() {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null!);
  const activities = useActivityStore((s) => s.activities);
  const currentIndex = useActivityStore((s) => s.currentIndex);
  const setScrollState = useActivityStore((s) => s.setScrollState);
  const yearlyTarget = useGoalStore((s) => s.yearlyTarget);

  // Compute pace ratio for each activity (matches scroll indicator colors)
  const paceRatios = useMemo(
    () =>
      activities.map((a) => {
        const date = new Date(a.start_date_local);
        const { ratio } = calculateYearlyPaceAtDate(activities, yearlyTarget, date);
        return ratio;
      }),
    [activities, yearlyTarget]
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      if (activities.length <= 1) return;
      const target = index / (activities.length - 1);
      const scrollable = scroll.el.scrollHeight - scroll.el.clientHeight;
      scroll.el.scrollTo({ top: target * scrollable, behavior: "smooth" });
    },
    [activities.length, scroll]
  );

  useFrame(() => {
    if (!groupRef.current || activities.length === 0) return;

    const totalDepth = (activities.length - 1) * RUN_SPACING;
    groupRef.current.position.z = scroll.offset * totalDepth;

    const rawIndex = scroll.offset * (activities.length - 1);
    const index = Math.round(rawIndex);
    const progress = rawIndex - Math.floor(rawIndex);
    setScrollState(index, progress);
  });

  return (
    <group ref={groupRef}>
      {activities.map((activity, index) => (
        <RunCard
          key={activity.id}
          activity={activity}
          index={index}
          zPosition={-index * RUN_SPACING}
          totalRuns={activities.length}
          paceRatio={paceRatios[index]}
          isFocused={index === currentIndex}
          onSelect={() => scrollToIndex(index)}
        />
      ))}
    </group>
  );
}

"use client";

import { useRef, useMemo } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RunCard } from "./RunCard";
import { useActivityStore } from "@/stores/activityStore";

const RUN_SPACING = 12;

export function RunTimeline() {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null!);
  const activities = useActivityStore((s) => s.activities);
  const setScrollState = useActivityStore((s) => s.setScrollState);

  const allSpeeds = useMemo(
    () => activities.map((a) => a.average_speed),
    [activities]
  );

  useFrame(() => {
    if (!groupRef.current || activities.length === 0) return;

    // Move group along Z based on scroll
    const totalDepth = (activities.length - 1) * RUN_SPACING;
    groupRef.current.position.z = scroll.offset * totalDepth;

    // Write current index to store for DOM overlay to read
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
          allSpeeds={allSpeeds}
        />
      ))}
    </group>
  );
}

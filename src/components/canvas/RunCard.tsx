"use client";

import { useRef, useMemo } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StravaActivity } from "@/lib/strava/types";
import { RouteGeometry, RouteGlow } from "./RouteGeometry";
import { getRouteColor } from "@/lib/colors";

interface RunCardProps {
  activity: StravaActivity;
  index: number;
  zPosition: number;
  totalRuns: number;
  allSpeeds: number[];
}

export function RunCard({
  activity,
  index,
  zPosition,
  totalRuns,
  allSpeeds,
}: RunCardProps) {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null!);
  const materialRef = useRef<MeshLineMaterial>(null);

  const scrollSegment = 1 / Math.max(totalRuns, 1);
  const scrollStart = index * scrollSegment;

  const color = useMemo(
    () => getRouteColor(activity.average_speed, allSpeeds),
    [activity.average_speed, allSpeeds]
  );

  useFrame(() => {
    if (!groupRef.current) return;

    // Bell curve: 0 → 1 → 0 as scroll passes through this run
    const visibility = scroll.curve(scrollStart, scrollSegment);

    // Scale
    const scale = THREE.MathUtils.lerp(0.5, 1.0, visibility);
    groupRef.current.scale.setScalar(scale);

    // Opacity
    if (materialRef.current) {
      (materialRef.current as unknown as { opacity: number }).opacity = visibility;
    }

    // Subtle rotation for parallax depth feel
    groupRef.current.rotation.y = (1 - visibility) * 0.12;
    groupRef.current.rotation.x = (1 - visibility) * 0.03;
  });

  return (
    <group ref={groupRef} position={[0, 0, zPosition]}>
      <RouteGlow
        activityId={activity.id}
        polyline={activity.map.summary_polyline}
        color={color}
      />
      <RouteGeometry
        activityId={activity.id}
        polyline={activity.map.summary_polyline}
        color={color}
        materialRef={materialRef}
      />
    </group>
  );
}

// Import for type
import type { MeshLineMaterial } from "meshline";

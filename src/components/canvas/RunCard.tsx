"use client";

import { useRef, useMemo, useState } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { StravaActivity } from "@/lib/strava/types";
import { RouteGeometry } from "./RouteGeometry";
import { getRouteColor } from "@/lib/colors";

interface RunCardProps {
  activity: StravaActivity;
  index: number;
  zPosition: number;
  totalRuns: number;
  allSpeeds: number[];
  onSelect: () => void;
}

export function RunCard({
  activity,
  index,
  zPosition,
  totalRuns,
  allSpeeds,
  onSelect,
}: RunCardProps) {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  const scrollSegment = 1 / Math.max(totalRuns, 1);
  const scrollCenter = index * scrollSegment + scrollSegment * 0.5;

  const color = useMemo(
    () => getRouteColor(activity.average_speed, allSpeeds),
    [activity.average_speed, allSpeeds]
  );

  useFrame(() => {
    if (!groupRef.current) return;

    // How far this run is from the current scroll center (0 = centered, 1 = far)
    const distFromCenter = Math.abs(scroll.offset - scrollCenter) / scrollSegment;

    // Visibility: sharp falloff — fully visible when centered, gone when >1.5 runs away
    const visibility = THREE.MathUtils.clamp(
      1 - distFromCenter * 0.7,
      0,
      1
    );

    // Scale: runs grow as they approach center
    const scale = THREE.MathUtils.lerp(0.3, 1.0, visibility);
    groupRef.current.scale.setScalar(scale);

    // Opacity — respect each material's baseOpacity
    const vis = Math.pow(visibility, 1.5);
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material as THREE.Material & {
          opacity: number;
          userData: { baseOpacity?: number };
        };
        const base = mat.userData?.baseOpacity ?? 1.0;
        mat.opacity = base * vis;
      }
    });

    // Subtle rotation when off-center
    groupRef.current.rotation.y = (1 - visibility) * 0.15;
    groupRef.current.rotation.x = (1 - visibility) * -0.05;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <group
      ref={groupRef}
      position={[0, 0, zPosition]}
      onClick={handleClick}
      onPointerEnter={() => {
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      <RouteGeometry
        activityId={activity.id}
        polyline={activity.map.summary_polyline}
        color={color}
      />
      {/* Invisible hit area for click detection */}
      <mesh visible={false}>
        <planeGeometry args={[12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

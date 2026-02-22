"use client";

import { useRef, useMemo, useState } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { StravaActivity } from "@/lib/strava/types";
import { RouteGeometry } from "./RouteGeometry";
import { MapOverlay } from "./MapOverlay";
import { getRouteColor } from "@/lib/colors";
import { useActivityStore } from "@/stores/activityStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface RunCardProps {
  activity: StravaActivity;
  index: number;
  zPosition: number;
  totalRuns: number;
  paceRatio: number;
  isFocused: boolean;
  onSelect: () => void;
}

export function RunCard({
  activity,
  index,
  zPosition,
  totalRuns,
  paceRatio,
  isFocused,
  onSelect,
}: RunCardProps) {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  const showMapOverlay = useSettingsStore((s) => s.showMapOverlay);
  const decodedRoute = useActivityStore((s) => s.decodedRoutes.get(activity.id));

  const scrollSegment = 1 / Math.max(totalRuns - 1, 1);
  const scrollCenter = totalRuns <= 1 ? 0.5 : index / (totalRuns - 1);

  const color = useMemo(
    () => getRouteColor(paceRatio),
    [paceRatio]
  );

  useFrame(() => {
    if (!groupRef.current) return;

    // How far this run is from the current scroll center (0 = centered, 1 = far)
    const distFromCenter = Math.abs(scroll.offset - scrollCenter) / scrollSegment;

    // Visibility: aggressive falloff — fully visible when centered, nearly gone when 1 run away
    const visibility = THREE.MathUtils.clamp(
      1 - distFromCenter * 1.2,
      0,
      1
    );

    // Scale: runs grow as they approach center
    const scale = THREE.MathUtils.lerp(0.3, 1.0, visibility);
    groupRef.current.scale.setScalar(scale);

    // Opacity — steep power curve so adjacent runs are very faint
    const vis = Math.pow(visibility, 3.0);
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
        showTracer={isFocused}
        averageSpeed={activity.average_speed}
        maxSpeed={activity.max_speed}
      />
      {showMapOverlay && decodedRoute?.normParams && decodedRoute.points.length > 0 && (
        <MapOverlay
          activityId={activity.id}
          rawPoints={decodedRoute.points}
          normParams={decodedRoute.normParams}
        />
      )}
      {/* Invisible hit area for click detection */}
      <mesh visible={false}>
        <planeGeometry args={[12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

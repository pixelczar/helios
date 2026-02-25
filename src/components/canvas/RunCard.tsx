"use client";

import { useRef, useMemo, useState } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { StravaActivity } from "@/lib/strava/types";
import { RouteGeometry } from "./RouteGeometry";
import { PlaceholderGeometry } from "./PlaceholderGeometry";
import { MapOverlay } from "./MapOverlay";
import { PhotoPins } from "./PhotoPins";
import { getRouteColor } from "@/lib/colors";
import { useActivityStore } from "@/stores/activityStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { wasPanDrag } from "./CameraPan";

interface RunCardProps {
  activity: StravaActivity;
  index: number;
  zPosition: number;
  totalRuns: number;
  totalSlots: number;
  paceRatio: number;
  prevPaceRatio: number;
  isFocused: boolean;
  onSelect: () => void;
}

export function RunCard({
  activity,
  index,
  zPosition,
  totalRuns,
  totalSlots,
  paceRatio,
  prevPaceRatio,
  isFocused,
  onSelect,
}: RunCardProps) {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  const showMapOverlay = useSettingsStore((s) => s.showMapOverlay);
  const decodedRoute = useActivityStore((s) => s.decodedRoutes.get(activity.id));

  // totalSlots = N (N activities, Today sits at offset 1 after all of them)
  // Activity at index i has scrollCenter at i / totalSlots
  const scrollSegment = 1 / Math.max(totalSlots, 1);
  const scrollCenter = totalSlots <= 0 ? 0.5 : index / totalSlots;

  const color = useMemo(
    () => getRouteColor(paceRatio),
    [paceRatio]
  );

  const colorEnd = useMemo(
    () => getRouteColor(prevPaceRatio),
    [prevPaceRatio]
  );

  // Spring impulse that fires once when this card snaps into focus
  const kick = useRef({
    z: 0, vz: 0,
    ry: 0, vry: 0,
    rz: 0, vrz: 0,
    wasFocused: false,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // How far this run is from the current scroll center (0 = centered, 1 = far)
    const distFromCenter = Math.abs(scroll.offset - scrollCenter) / scrollSegment;

    // Visibility: sharp falloff so only the focused run is prominent
    const visibility = THREE.MathUtils.clamp(
      1 - distFromCenter * 1.2,
      0,
      1
    );

    // Scale: runs grow as they approach center
    const scale = THREE.MathUtils.lerp(0.3, 1.0, visibility);
    groupRef.current.scale.setScalar(scale);

    // Opacity — cubic curve for aggressive fade on neighbors
    const vis = Math.pow(visibility, 3.0);
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material as THREE.Material & {
          opacity: number;
          userData: { baseOpacity?: number; skipVisibility?: boolean };
        };
        const base = mat.userData?.baseOpacity ?? 1.0;
        mat.opacity = mat.userData?.skipVisibility ? base : base * vis;
      }
    });

    // Fire impulse on focus transition
    const k = kick.current;
    if (isFocused && !k.wasFocused) {
      k.vz = 0.8;
      k.vry = 0.4;
      k.vrz = 0.15;
    }
    k.wasFocused = isFocused;

    // Damp the kick spring (stiffness 200, damping 14 → ~0.5 ratio, settles in ~0.4s)
    const dt = Math.min(delta, 0.04);
    const kS = 200, kD = 14;

    k.vz += (-kS * k.z - kD * k.vz) * dt;
    k.z += k.vz * dt;

    k.vry += (-kS * k.ry - kD * k.vry) * dt;
    k.ry += k.vry * dt;

    k.vrz += (-kS * k.rz - kD * k.vrz) * dt;
    k.rz += k.vrz * dt;

    // Subtle rotation when off-center + kick
    groupRef.current.rotation.y = (1 - visibility) * 0.15 + k.ry;
    groupRef.current.rotation.x = (1 - visibility) * -0.05;
    groupRef.current.rotation.z = k.rz;
    groupRef.current.position.z = zPosition + k.z;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (wasPanDrag()) return;
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
      {activity.map.summary_polyline ? (
        <RouteGeometry
          activityId={activity.id}
          polyline={activity.map.summary_polyline}
          color={color}
          colorEnd={colorEnd}
          showTracer={isFocused}
          averageSpeed={activity.average_speed}
          maxSpeed={activity.max_speed}
        />
      ) : (
        <PlaceholderGeometry color={color} colorEnd={colorEnd} showTracer={isFocused} />
      )}
      {showMapOverlay && decodedRoute?.normParams && decodedRoute.points.length > 0 && (
        <MapOverlay
          activityId={activity.id}
          rawPoints={decodedRoute.points}
          normParams={decodedRoute.normParams}
        />
      )}
      {isFocused && decodedRoute?.normParams && activity.total_photo_count > 0 && (
        <PhotoPins
          activityId={activity.id}
          normParams={decodedRoute.normParams}
          color={color}
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

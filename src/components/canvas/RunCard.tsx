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
import { wasPanDrag } from "./CameraPan";
import { cardPoses, parallax } from "./motionState";

// Lower = neighbors linger longer while crossing (was 1.2: fully hand-off)
const VISIBILITY_FALLOFF = 0.8;

interface RunCardProps {
  activity: StravaActivity;
  index: number;
  zPosition: number;
  totalRuns: number;
  totalSlots: number;
  paceRatio: number;
  prevPaceRatio: number;
  isFocused: boolean;
  showMap: boolean;
  showRoute: boolean;
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
  showMap,
  showRoute,
  onSelect,
}: RunCardProps) {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  // Shared with RouteGeometry so the line draws on as the card comes into focus
  const visibilityRef = useRef(0);
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
    active: false,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // How far this run is from the current scroll center (0 = centered, 1 = far)
    const distFromCenter = Math.abs(scroll.offset - scrollCenter) / scrollSegment;

    // Visibility: falloff wide enough that neighbors overlap mid-transition
    // (both ~35% at the halfway point) for a crossfade, not a hand-off
    const visibility = THREE.MathUtils.clamp(
      1 - distFromCenter * VISIBILITY_FALLOFF,
      0,
      1
    );
    visibilityRef.current = visibility;

    // Scale: runs grow as they approach center
    const scale = THREE.MathUtils.lerp(0.3, 1.0, visibility);
    groupRef.current.scale.setScalar(scale);

    // Opacity — hold full strength through the first half-step and fade only
    // in the second, so outgoing and incoming runs are both at full strength
    // mid-transition (maximum overlap) and nothing lingers once settled
    const vis = 1 - THREE.MathUtils.smoothstep(distFromCenter, 0.5, 1.0);

    // Fully faded runs are skipped entirely — otherwise every mounted map
    // and tube is still submitted to the GPU at zero opacity
    groupRef.current.visible = vis > 0.002;
    if (groupRef.current.visible) groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material as THREE.Material & {
          opacity: number;
          userData: { baseOpacity?: number; skipVisibility?: boolean };
        };
        if (mat.userData?.skipVisibility) return;
        const base = mat.userData?.baseOpacity ?? 1.0;
        mat.opacity = base * vis;
      }
    });

    // Fire impulse on focus transition
    const k = kick.current;
    if (isFocused && !k.wasFocused) {
      k.vz = 0.8;
      k.vry = 0.4;
      k.vrz = 0.15;
      k.active = true;
    }
    k.wasFocused = isFocused;

    // Only run spring math while kick is active
    if (k.active) {
      const dt = Math.min(delta, 0.04);
      const kS = 200, kD = 14;

      k.vz += (-kS * k.z - kD * k.vz) * dt;
      k.z += k.vz * dt;
      k.vry += (-kS * k.ry - kD * k.vry) * dt;
      k.ry += k.vry * dt;
      k.vrz += (-kS * k.rz - kD * k.vrz) * dt;
      k.rz += k.vrz * dt;

      // Sleep when settled
      if (Math.abs(k.z) + Math.abs(k.vz) + Math.abs(k.ry) + Math.abs(k.vry) + Math.abs(k.rz) + Math.abs(k.vrz) < 0.001) {
        k.z = k.vz = k.ry = k.vry = k.rz = k.vrz = 0;
        k.active = false;
      }
    }

    // Subtle rotation when off-center + kick
    // Pointer tilt — the whole run (route + map together, so the line stays
    // registered to its streets) leans toward the cursor; weighted by
    // visibility so only the run in front moves
    const tiltX = parallax.x * visibility;
    const tiltY = parallax.y * visibility;
    groupRef.current.rotation.y = (1 - visibility) * 0.15 + k.ry + tiltY;
    groupRef.current.rotation.x = (1 - visibility) * -0.05 + tiltX;
    groupRef.current.rotation.z = k.rz;
    groupRef.current.position.z = zPosition + k.z;

    // Publish the pose so the morph line can match this card exactly
    const worldZ = (groupRef.current.parent?.position.z ?? 0) + groupRef.current.position.z;
    const pose = cardPoses.get(index);
    if (pose) {
      pose.rx = groupRef.current.rotation.x;
      pose.ry = groupRef.current.rotation.y;
      pose.rz = k.rz;
      pose.z = worldZ;
      pose.scale = scale;
    } else {
      cardPoses.set(index, { rx: groupRef.current.rotation.x, ry: groupRef.current.rotation.y, rz: k.rz, z: worldZ, scale });
    }
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
      {!showRoute ? null : activity.map.summary_polyline ? (
        <RouteGeometry
          activityId={activity.id}
          polyline={activity.map.summary_polyline}
          color={color}
          colorEnd={colorEnd}
          showTracer={isFocused}
          visibilityRef={visibilityRef}
          averageSpeed={activity.average_speed}
          maxSpeed={activity.max_speed}
        />
      ) : (
        <PlaceholderGeometry color={color} colorEnd={colorEnd} showTracer={isFocused} />
      )}
      {showMap && decodedRoute?.normParams && decodedRoute.points.length > 0 && (
        <MapOverlay
          activityId={activity.id}
          tint={color}
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

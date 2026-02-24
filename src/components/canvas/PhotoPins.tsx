"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePhotoStore } from "@/stores/photoStore";
import { usePhotoModalStore } from "@/stores/photoModalStore";
import type { NormalizationParams } from "@/lib/geo/normalize";

interface PhotoPinsProps {
  activityId: number;
  normParams: NormalizationParams;
  color: THREE.Color;
}

// Torus ring reticle — lies flat in the XY plane (route plane)
// outerRadius, tube cross-section, radial segs, tubular segs
const glowRingGeo = new THREE.TorusGeometry(0.075, 0.014, 8, 48);
const coreRingGeo = new THREE.TorusGeometry(0.060, 0.006, 8, 48);
const dotGeo = new THREE.SphereGeometry(0.010, 8, 8);
// Invisible full-circle hit area covers the torus hole
const hitGeo = new THREE.CircleGeometry(0.09, 32);

const GLOW_OPACITY = 0.4;
const CORE_OPACITY = 0.85;
const DOT_OPACITY = 0.9;

interface PinMeshRefs {
  glowRing: THREE.Mesh | null;
}

export function PhotoPins({ activityId, normParams, color }: PhotoPinsProps) {
  const photos = usePhotoStore((s) => s.photos.get(activityId));
  const setExpandedPhotoUid = usePhotoModalStore((s) => s.setExpandedPhotoUid);

  const glowColor = useMemo(() => color.clone().multiplyScalar(1.6), [color]);
  const coreColor = useMemo(() => color.clone().multiplyScalar(2.8), [color]);
  const dotColor  = useMemo(() => color.clone().multiplyScalar(3.2), [color]);

  const pinRefs = useRef<Map<string, PinMeshRefs>>(new Map());

  const pins = useMemo(() => {
    if (!photos) return [];
    const { centerLat, centerLng, cosLat, scale } = normParams;
    return photos
      .filter((p) => p.location != null)
      .map((p) => {
        const [lat, lng] = p.location!;
        const x = (lng - centerLng) * cosLat * scale;
        const y = (lat - centerLat) * scale;
        return { uid: p.unique_id, position: new THREE.Vector3(x, y, 0.05) };
      });
  }, [photos, normParams]);

  // Gentle pulse on the glow ring only
  useFrame(({ clock }) => {
    const t = (Math.sin(clock.elapsedTime * 1.8) + 1) / 2;
    for (const { glowRing } of pinRefs.current.values()) {
      if (glowRing?.material) {
        const mat = glowRing.material as THREE.MeshBasicMaterial & {
          userData: { baseOpacity?: number };
        };
        mat.userData.baseOpacity = GLOW_OPACITY + t * 0.12;
      }
    }
  });

  if (!pins.length) return null;

  return (
    <group>
      {pins.map(({ uid, position }) => {
        if (!pinRefs.current.has(uid)) {
          pinRefs.current.set(uid, { glowRing: null });
        }

        return (
          <group
            key={uid}
            position={position}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedPhotoUid(uid);
            }}
            onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
            onPointerLeave={() => { document.body.style.cursor = "default"; }}
          >
            {/* Invisible hit disc — fills the torus hole so clicks register everywhere */}
            <mesh renderOrder={0} geometry={hitGeo} visible={false}>
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Outer glow ring */}
            <mesh
              renderOrder={0}
              geometry={glowRingGeo}
              ref={(m) => { if (m) pinRefs.current.get(uid)!.glowRing = m; }}
            >
              <meshBasicMaterial
                transparent
                color={glowColor}
                toneMapped={false}
                depthWrite={false}
                depthTest={false}
                blending={THREE.AdditiveBlending}
                opacity={GLOW_OPACITY}
              />
            </mesh>

            {/* Core ring */}
            <mesh renderOrder={1} geometry={coreRingGeo}>
              <meshBasicMaterial
                transparent
                color={coreColor}
                toneMapped={false}
                depthWrite={false}
                depthTest={false}
                blending={THREE.AdditiveBlending}
                opacity={CORE_OPACITY}
              />
            </mesh>

            {/* Center dot */}
            <mesh renderOrder={2} geometry={dotGeo}>
              <meshBasicMaterial
                transparent
                color={dotColor}
                toneMapped={false}
                depthWrite={true}
                depthTest={true}
                blending={THREE.NormalBlending}
                opacity={DOT_OPACITY}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

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

// Torus ring — scales outward from dot, fades via temporal envelope
const ringGeo = new THREE.TorusGeometry(0.03, 0.002, 6, 48);
const dotGeo = new THREE.SphereGeometry(0.018, 12, 12);
// Hit area much larger than the dot for forgiving clicks
const hitGeo = new THREE.CircleGeometry(0.14, 32);

const PIN_USER_DATA = { skipVisibility: true };
const PERIOD = 1.5;
const SCALE_MIN = 0.1;
const SCALE_MAX = 5.0;
const OPACITY_PEAK = .8;
const DOT_OPACITY = 0.9;

// Opacity envelope: smooth onset → pure exponential decay.
// e^(-t/τ) is how energy actually dissipates — heat, ripples, waves.
// Infinitely smooth at every derivative; no shoulders, no inflection points.
function opacityEnvelope(t: number): number {
  // Hermite-smooth onset over first 4% of cycle (~80ms)
  const u = Math.min(1, t / 0.04);
  const onset = u * u * (3 - 2 * u);
  // τ = 0.14 — sharper falloff, bright ~200ms, ghost by ~600ms
  return onset * Math.exp(-t / 0.14) * 1.33;
}

function uidToPhase(uid: string): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) - h + uid.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

function easeOutQuart(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv * inv;
}

interface PinMeshRefs {
  ring: THREE.Mesh | null;
  dot: THREE.Mesh | null;
}

export function PhotoPins({ activityId, normParams, color }: PhotoPinsProps) {
  const photos = usePhotoStore((s) => s.photos.get(activityId));
  const setExpandedPhotoUid = usePhotoModalStore((s) => s.setExpandedPhotoUid);

  const white = useMemo(() => new THREE.Color(1, 1, 1), []);

  const pinRefs = useRef<Map<string, PinMeshRefs>>(new Map());
  const hoveredUid = useRef<string | null>(null);

  const pins = useMemo(() => {
    if (!photos) return [];
    const { centerLat, centerLng, cosLat, scale } = normParams;
    return photos
      .filter((p) => p.location != null)
      .map((p) => {
        const [lat, lng] = p.location!;
        const x = (lng - centerLng) * cosLat * scale;
        const y = (lat - centerLat) * scale;
        return { uid: p.unique_id, position: new THREE.Vector3(x, y, 0.15) };
      });
  }, [photos, normParams]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.elapsedTime;
    const lerp = 1 - Math.exp(-10 * delta);

    for (const [uid, refs] of pinRefs.current.entries()) {
      // Ring: scales outward from dot, envelope fades it as it expands
      if (refs.ring) {
        const t = ((elapsed + uidToPhase(uid) * PERIOD) % PERIOD) / PERIOD;
        const scale = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * easeOutQuart(t);
        const opacity = OPACITY_PEAK * opacityEnvelope(t);

        refs.ring.scale.setScalar(scale);
        (refs.ring.material as THREE.MeshBasicMaterial).opacity = opacity;
      }

      // Dot hover feedback — smooth scale + brightness
      if (refs.dot) {
        const isHovered = uid === hoveredUid.current;
        const targetScale = isHovered ? 1.5 : 1.0;
        const targetOpacity = isHovered ? 1.0 : DOT_OPACITY;
        const mat = refs.dot.material as THREE.MeshBasicMaterial;
        refs.dot.scale.setScalar(
          THREE.MathUtils.lerp(refs.dot.scale.x, targetScale, lerp)
        );
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, lerp);
      }
    }
  });

  if (!pins.length) return null;

  return (
    <group>
      {pins.map(({ uid, position }) => {
        if (!pinRefs.current.has(uid)) {
          pinRefs.current.set(uid, { ring: null, dot: null });
        }

        return (
          <group
            key={uid}
            position={position}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedPhotoUid(uid);
            }}
            onPointerEnter={() => { document.body.style.cursor = "pointer"; hoveredUid.current = uid; }}
            onPointerLeave={() => { document.body.style.cursor = "default"; hoveredUid.current = null; }}
          >
            {/* Generous invisible hit disc */}
            <mesh renderOrder={0} geometry={hitGeo} visible={false}>
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Radiating ring */}
            <mesh
              renderOrder={10}
              geometry={ringGeo}
              ref={(m) => { if (m) pinRefs.current.get(uid)!.ring = m; }}
            >
              <meshBasicMaterial
                transparent
                color={white}
                toneMapped={false}
                depthWrite={false}
                depthTest={false}
                opacity={0}
                userData={PIN_USER_DATA}
              />
            </mesh>

            {/* Center dot */}
            <mesh
              renderOrder={11}
              geometry={dotGeo}
              ref={(m) => { if (m) pinRefs.current.get(uid)!.dot = m; }}
            >
              <meshBasicMaterial
                transparent
                color={white}
                toneMapped={false}
                depthWrite={false}
                depthTest={false}
                opacity={DOT_OPACITY}
                userData={PIN_USER_DATA}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

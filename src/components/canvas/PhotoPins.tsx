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
const dotGeo = new THREE.SphereGeometry(0.016, 12, 12);
// Hit area much larger than the dot for forgiving clicks
const hitGeo = new THREE.CircleGeometry(0.14, 32);

const PERIOD = 3.0;
const SCALE_MIN = 0.3;
const SCALE_MAX = 4.0;
const OPACITY_PEAK = 0.14;
const DOT_OPACITY = 0.22;

// --- Cubic bezier evaluator (CSS-style timing function) ---
function _bx(t: number, x1: number, x2: number) {
  const i = 1 - t;
  return 3 * i * i * t * x1 + 3 * i * t * t * x2 + t * t * t;
}
function _by(t: number, y1: number, y2: number) {
  const i = 1 - t;
  return 3 * i * i * t * y1 + 3 * i * t * t * y2 + t * t * t;
}
function _bdx(t: number, x1: number, x2: number) {
  const i = 1 - t;
  return 3 * i * i * x1 + 6 * i * t * (x2 - x1) + 3 * t * t * (1 - x2);
}
function cubicBezier(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = _bx(t, x1, x2) - x;
    if (Math.abs(err) < 1e-6) break;
    const d = _bdx(t, x1, x2);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  return _by(Math.max(0, Math.min(1, t)), y1, y2);
}

// Opacity envelope: bezier-shaped quick attack + long silky fade.
// Zero at both boundaries for seamless loop.
function opacityEnvelope(t: number): number {
  // Quick ramp in — first 10% of cycle
  // (0.0, 0.8, 0.3, 1.0): snappy ease-out, reaches full brightness fast
  const ramp = t < 0.1
    ? cubicBezier(t / 0.1, 0.0, 0.8, 0.3, 1.0)
    : 1.0;

  // Long fade out — starts at 8% (slight overlap with ramp for smooth peak)
  // (0.12, 0.72, 0.32, 1.0): drops quickly at first, then long wispy tail
  const fadeProg = Math.max(0, (t - 0.08) / 0.92);
  const fade = 1 - cubicBezier(fadeProg, 0.12, 0.72, 0.32, 1.0);

  return ramp * fade;
}

function uidToPhase(uid: string): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) - h + uid.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
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
        const scale = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * easeOutCubic(t);
        const opacity = OPACITY_PEAK * opacityEnvelope(t);

        refs.ring.scale.setScalar(scale);
        (refs.ring.material as THREE.MeshBasicMaterial).opacity = opacity;
      }

      // Dot hover feedback — smooth scale + brightness
      if (refs.dot) {
        const isHovered = uid === hoveredUid.current;
        const targetScale = isHovered ? 1.8 : 1.0;
        const targetOpacity = isHovered ? 0.45 : DOT_OPACITY;
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
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

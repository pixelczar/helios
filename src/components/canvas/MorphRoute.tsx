"use client";

import { useEffect, useMemo, useRef } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StravaActivity } from "@/lib/strava/types";
import { useActivityStore } from "@/stores/activityStore";
import { getRouteColor } from "@/lib/colors";
import { createRouteTube, writeRouteTube } from "@/lib/geo/tube";
import { useRouteControls } from "./useRouteControls";
import { cardPoses, morphState } from "./motionState";

// Samples per route — both shapes are resampled to the same count, evenly
// spaced by arc length, so point i on one run maps to point i on the next
const SAMPLES = 480;
const RADIAL_SEGMENTS = 6;
// Morph line fades in over the first/last 4% of a step (as a fraction of
// the half-step), so it hands off to the real route right before settling
const HANDOFF = 0.08;

interface MorphRouteProps {
  activities: StravaActivity[];
  paceRatios: number[];
  totalSlots: number;
}

/**
 * One route line that reshapes from run to run while scrolling. The cards'
 * own lines step aside (morphState.routeHide) for the length of the step;
 * their maps keep flying and crossfading underneath. At either end the
 * morph line matches the settled card exactly — same samples, pose and kick
 * depth — so the swap is invisible.
 */
export function MorphRoute({ activities, paceRatios, totalSlots }: MorphRouteProps) {
  const scroll = useScroll();
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);
  const controls = useRouteControls();
  const groupRef = useRef<THREE.Group>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Read only inside useFrame, so a ref is enough (no re-render needed)
  const reducedMotion = useRef(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Resampled shapes, cached per run (same Catmull-Rom smoothing as the cards)
  const samplesRef = useRef(new Map<number, Float32Array>());
  useEffect(() => {
    samplesRef.current = new Map();
  }, [controls.smoothTension, decodedRoutes]);
  const getSamples = (activityId: number): Float32Array | null => {
    const samples = samplesRef.current;
    const cached = samples.get(activityId);
    if (cached) return cached;
    const route = decodedRoutes.get(activityId);
    if (!route || route.normalized.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(
      route.normalized.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      "catmullrom",
      controls.smoothTension
    );
    const pts = curve.getSpacedPoints(SAMPLES - 1);
    const out = new Float32Array(SAMPLES * 2);
    pts.forEach((p, i) => {
      out[i * 2] = p.x;
      out[i * 2 + 1] = p.y;
    });
    samples.set(activityId, out);
    return out;
  };

  const { coreGeo, glowGeo, points, colors } = useMemo(() => {
    const core = createRouteTube(SAMPLES, RADIAL_SEGMENTS);
    const glow = createRouteTube(SAMPLES, RADIAL_SEGMENTS);
    const colorArray = new Float32Array(SAMPLES * (RADIAL_SEGMENTS + 1) * 4);
    const colorAttr = new THREE.BufferAttribute(colorArray, 4);
    core.setAttribute("color", colorAttr);
    glow.setAttribute("color", colorAttr);
    return {
      coreGeo: core,
      glowGeo: glow,
      points: Array.from({ length: SAMPLES }, () => new THREE.Vector3()),
      colors: colorAttr,
    };
  }, []);
  useEffect(() => () => {
    coreGeo.dispose();
    glowGeo.dispose();
  }, [coreGeo, glowGeo]);

  const tmpA = useMemo(() => new THREE.Color(), []);
  const tmpB = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const raw = THREE.MathUtils.clamp(scroll.offset * totalSlots, 0, totalSlots);
    const lo = Math.min(Math.floor(raw), totalSlots);
    const hi = Math.min(lo + 1, totalSlots);
    const frac = raw - lo;
    const a = lo < activities.length ? getSamples(activities[lo].id) : null;
    const b = hi < activities.length && hi !== lo ? getSamples(activities[hi].id) : null;

    // Only morph between two real routes (not into Today or an indoor run)
    const halfStep = Math.min(frac, 1 - frac) * 2;
    const vis = !reducedMotion.current && a && b ? THREE.MathUtils.smoothstep(halfStep, 0, HANDOFF) : 0;
    morphState.routeHide = vis;
    group.visible = vis > 0.001;
    if (!group.visible || !a || !b) return;

    // Ease the shape through the step; position stays scroll-linked
    const t = frac * frac * (3 - 2 * frac);

    for (let i = 0; i < SAMPLES; i++) {
      points[i].set(
        a[i * 2] + (b[i * 2] - a[i * 2]) * t,
        a[i * 2 + 1] + (b[i * 2 + 1] - a[i * 2 + 1]) * t,
        0
      );
    }
    writeRouteTube(coreGeo, points, controls.coreWidth / 2, RADIAL_SEGMENTS);
    writeRouteTube(glowGeo, points, controls.glowWidth / 2, RADIAL_SEGMENTS);

    const cA = getRouteColor(paceRatios[lo]);
    const cAEnd = getRouteColor(paceRatios[Math.max(0, lo - 1)]);
    const cB = getRouteColor(paceRatios[hi]);
    const cBEnd = getRouteColor(paceRatios[Math.max(0, hi - 1)]);
    writeMorphColors(colors, coreGeo, t, cA, cAEnd, cB, cBEnd, controls.gradPeakPoint, controls.gradEndAlpha, tmpA, tmpB);

    // Match the cards' tilt/kick so the hand-off at either end is seamless
    const pa = cardPoses.get(lo);
    const pb = cardPoses.get(hi);
    if (pa && pb) {
      group.rotation.set(
        pa.rx + (pb.rx - pa.rx) * t,
        pa.ry + (pb.ry - pa.ry) * t,
        pa.rz + (pb.rz - pa.rz) * t
      );
      group.position.z = pa.kz + (pb.kz - pa.kz) * t;
    }

    if (coreMatRef.current) coreMatRef.current.opacity = controls.coreOpacity * vis;
    if (glowMatRef.current) glowMatRef.current.opacity = controls.glowOpacity * vis;
  });

  const coreBrightness = useMemo(
    () => new THREE.Color(controls.coreBrightness, controls.coreBrightness, controls.coreBrightness),
    [controls.coreBrightness]
  );
  const glowBrightness = useMemo(
    () => new THREE.Color(controls.glowBrightness, controls.glowBrightness, controls.glowBrightness),
    [controls.glowBrightness]
  );

  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={glowGeo} renderOrder={2} frustumCulled={false}>
        <meshBasicMaterial
          ref={glowMatRef}
          transparent
          vertexColors
          color={glowBrightness}
          toneMapped={false}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </mesh>
      <mesh geometry={coreGeo} renderOrder={3} frustumCulled={false}>
        <meshBasicMaterial
          ref={coreMatRef}
          transparent
          vertexColors
          color={coreBrightness}
          toneMapped={false}
          depthWrite={false}
          depthTest={false}
          opacity={0}
        />
      </mesh>
    </group>
  );
}

// Pace color gradient + alpha fade per ring, blended between the two runs
// (matches RouteGeometry: run color → previous run's color along the line)
function writeMorphColors(
  colors: THREE.BufferAttribute,
  geo: THREE.BufferGeometry,
  t: number,
  cA: THREE.Color,
  cAEnd: THREE.Color,
  cB: THREE.Color,
  cBEnd: THREE.Color,
  peak: number,
  endAlpha: number,
  tmpA: THREE.Color,
  tmpB: THREE.Color
) {
  const stops: [number, number][] = [
    [0, 0],
    [peak, 1],
    [1, endAlpha],
  ];
  const arr = colors.array as Float32Array;
  const ringSize = RADIAL_SEGMENTS + 1;
  const uvs = geo.attributes.uv.array as Float32Array;
  for (let i = 0; i < SAMPLES; i++) {
    const u = uvs[i * ringSize * 2];
    tmpA.copy(cA).lerp(cAEnd, u);
    tmpB.copy(cB).lerp(cBEnd, u);
    tmpA.lerp(tmpB, t);
    let alpha = 0;
    for (let s = 0; s < stops.length - 1; s++) {
      if (u <= stops[s + 1][0]) {
        const len = stops[s + 1][0] - stops[s][0];
        const k = len > 0 ? (u - stops[s][0]) / len : 0;
        alpha = stops[s][1] + (stops[s + 1][1] - stops[s][1]) * k;
        break;
      }
    }
    for (let j = 0; j < ringSize; j++) {
      const o = (i * ringSize + j) * 4;
      arr[o] = tmpA.r;
      arr[o + 1] = tmpA.g;
      arr[o + 2] = tmpA.b;
      arr[o + 3] = alpha;
    }
  }
  colors.needsUpdate = true;
}

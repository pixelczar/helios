"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { extend, useFrame, useThree } from "@react-three/fiber";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";
import { decodePolyline } from "@/lib/geo/polyline";
import { normalizeRoute } from "@/lib/geo/normalize";
import { simplifyRoute } from "@/lib/geo/simplify";
import { useActivityStore } from "@/stores/activityStore";
import { useRouteControls } from "./useRouteControls";

extend({ MeshLineGeometry, MeshLineMaterial });

interface RouteGeometryProps {
  activityId: number;
  polyline: string | null;
  color: THREE.Color;
  showTracer?: boolean;
  averageSpeed?: number; // m/s
  maxSpeed?: number; // m/s
}

export function RouteGeometry({
  activityId,
  polyline,
  color,
  showTracer = false,
  averageSpeed = 0,
  maxSpeed = 0,
}: RouteGeometryProps) {
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);
  const controls = useRouteControls();
  const size = useThree((s) => s.size);
  const resolution = useMemo(() => new THREE.Vector2(size.width, size.height), [size.width, size.height]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coreMatRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pulseMatRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const glowMatRef = useRef<any>(null);
  const capGlowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Raw normalized 2D points (before smoothing)
  const rawPoints = useMemo(() => {
    const cached = decodedRoutes.get(activityId);
    if (cached && cached.normalized.length > 0) {
      return cached.normalized;
    }

    if (!polyline) return null;

    const decoded = decodePolyline(polyline);
    if (decoded.length < 2) return null;

    const simplified =
      decoded.length > 800 ? simplifyRoute(decoded, 0.00002) : decoded;
    return normalizeRoute(simplified, 5);
  }, [activityId, polyline, decodedRoutes]);

  // Smoothed + flattened line points
  const linePoints = useMemo(() => {
    if (!rawPoints || rawPoints.length < 2) return null;

    if (!controls.smoothEnabled || rawPoints.length < 3) {
      return rawPoints.flatMap(([x, y]) => [x, y, 0]);
    }

    // Catmull-Rom spline interpolation
    const curve = new THREE.CatmullRomCurve3(
      rawPoints.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      "catmullrom",
      controls.smoothTension
    );
    const totalSegments = rawPoints.length * controls.smoothSubdivisions;
    const smoothed = curve.getPoints(totalSegments);
    return smoothed.flatMap((p) => [p.x, p.y, p.z]);
  }, [rawPoints, controls.smoothEnabled, controls.smoothTension, controls.smoothSubdivisions]);

  const coreColor = useMemo(
    () => color.clone().multiplyScalar(controls.coreBrightness),
    [color, controls.coreBrightness]
  );
  const glowColorVal = useMemo(
    () => color.clone().multiplyScalar(controls.glowBrightness),
    [color, controls.glowBrightness]
  );

  // Gradient alpha texture — rebuilt when gradient controls change
  const alphaGradient = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(controls.gradHoldEnd, "rgba(255,255,255,1)");
    grad.addColorStop(
      controls.gradMidPoint,
      `rgba(255,255,255,${controls.gradMidAlpha})`
    );
    grad.addColorStop(
      controls.gradTailPoint,
      `rgba(255,255,255,${controls.gradTailAlpha})`
    );
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 1);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [
    controls.gradHoldEnd,
    controls.gradMidPoint,
    controls.gradMidAlpha,
    controls.gradTailPoint,
    controls.gradTailAlpha,
  ]);

  const firstPoint = useMemo(() => {
    if (!linePoints || linePoints.length < 6) return null;
    return new THREE.Vector3(linePoints[0], linePoints[1], linePoints[2]);
  }, [linePoints]);

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Dynamic cap geometries
  const glowCapGeo = useMemo(
    () => new THREE.SphereGeometry(controls.capGlowRadius, 16, 16),
    [controls.capGlowRadius]
  );
  const coreCapGeo = useMemo(
    () => new THREE.SphereGeometry(controls.capCoreRadius, 12, 12),
    [controls.capCoreRadius]
  );

  // Priority -1 so base opacities are set BEFORE RunCard's visibility traverse (priority 0)
  useFrame(({ clock }, delta) => {
    // Set userData.baseOpacity so RunCard's traverse computes: opacity = base * visibility
    if (coreMatRef.current) {
      coreMatRef.current.userData.baseOpacity = controls.coreOpacity;
    }
    if (glowMatRef.current) {
      // Skip breathing animation when user prefers reduced motion
      const breathe =
        !prefersReducedMotion && controls.glowBreatheSpeed > 0
          ? controls.glowOpacity +
            Math.sin(clock.elapsedTime * controls.glowBreatheSpeed) *
              controls.glowBreatheAmount
          : controls.glowOpacity;
      glowMatRef.current.userData.baseOpacity = breathe;
    }
    if (pulseMatRef.current) {
      // Skip tracer animation when user prefers reduced motion
      if (!prefersReducedMotion) {
        // Pace-driven tracer speed:
        // - speedFactor scales base speed by the activity's avg pace (faster run = faster tracer)
        // - variability creates organic surges using layered sines, amplitude from max/avg spread
        const speedFactor = averageSpeed > 0
          ? THREE.MathUtils.clamp(averageSpeed / 3.0, 0.5, 2.0) // ~3 m/s ≈ 10min/mi as baseline
          : 1.0;
        const spread = maxSpeed > 0 && averageSpeed > 0
          ? THREE.MathUtils.clamp((maxSpeed / averageSpeed - 1) * 1.2, 0.15, 0.8)
          : 0.3;
        const t = clock.elapsedTime;
        const variability = 1.0
          + Math.sin(t * 0.5) * spread           // big tempo shift
          + Math.sin(t * 1.3) * spread * 0.6     // mid-run pace change
          + Math.sin(t * 3.1) * spread * 0.3     // cadence wobble
          + Math.sin(t * 7.7) * spread * 0.1;    // micro stutter

        pulseMatRef.current.dashOffset -= delta * controls.tracerSpeed * speedFactor * variability;
      }
      pulseMatRef.current.userData.baseOpacity = controls.tracerOpacity;
    }
    if (capGlowMatRef.current) {
      capGlowMatRef.current.userData.baseOpacity = controls.capGlowOpacity;
    }
  }, -1);

  if (!linePoints || linePoints.length < 6) return null;

  return (
    <group>
      {/* Soft glow halo */}
      <mesh renderOrder={0}>
        {/* @ts-expect-error meshline types */}
        <meshLineGeometry points={linePoints} />
        {/* @ts-expect-error meshline types */}
        <meshLineMaterial
          ref={glowMatRef}
          transparent
          lineWidth={controls.glowWidth}
          color={glowColorVal}
          resolution={resolution}
          toneMapped={false}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          opacity={controls.glowOpacity}
          useAlphaMap={true}
          alphaMap={alphaGradient}
        />
      </mesh>

      {/* Core line */}
      <mesh renderOrder={1}>
        {/* @ts-expect-error meshline types */}
        <meshLineGeometry points={linePoints} />
        {/* @ts-expect-error meshline types */}
        <meshLineMaterial
          ref={coreMatRef}
          transparent
          lineWidth={controls.coreWidth}
          color={coreColor}
          resolution={resolution}
          toneMapped={false}
          depthWrite={true}
          depthTest={true}
          blending={THREE.NormalBlending}
          opacity={controls.coreOpacity}
          useAlphaMap={true}
          alphaMap={alphaGradient}
        />
      </mesh>

      {/* Tracer spark — only on the focused route */}
      {controls.tracerEnabled && showTracer && (
        <mesh renderOrder={2}>
          {/* @ts-expect-error meshline types */}
          <meshLineGeometry points={linePoints} />
          {/* @ts-expect-error meshline types */}
          <meshLineMaterial
            ref={pulseMatRef}
            transparent
            lineWidth={controls.tracerWidth}
            color={coreColor}
            resolution={resolution}
            toneMapped={false}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            opacity={controls.tracerOpacity}
            dashArray={controls.tracerDashArray}
            dashRatio={controls.tracerDashRatio}
            dashOffset={0}
          />
        </mesh>
      )}

      {/* Start cap */}
      {controls.capEnabled && firstPoint && (
        <>
          <mesh position={firstPoint} renderOrder={0} geometry={glowCapGeo}>
            <meshBasicMaterial
              ref={capGlowMatRef}
              transparent
              color={glowColorVal}
              toneMapped={false}
              depthWrite={false}
              depthTest={false}
              blending={THREE.AdditiveBlending}
              opacity={controls.capGlowOpacity}
            />
          </mesh>
          <mesh position={firstPoint} renderOrder={1} geometry={coreCapGeo}>
            <meshBasicMaterial
              transparent
              color={coreColor}
              toneMapped={false}
              depthWrite={true}
              depthTest={true}
              blending={THREE.NormalBlending}
              opacity={1}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { decodePolyline } from "@/lib/geo/polyline";
import { normalizeRoute } from "@/lib/geo/normalize";
import { simplifyRoute } from "@/lib/geo/simplify";
import { useActivityStore } from "@/stores/activityStore";
import { useRouteControls } from "./useRouteControls";

const RADIAL_SEGMENTS = 6;

interface RouteGeometryProps {
  activityId: number;
  polyline: string | null;
  color: THREE.Color;
  colorEnd?: THREE.Color;
  showTracer?: boolean;
  averageSpeed?: number; // m/s
  maxSpeed?: number; // m/s
}

export function RouteGeometry({
  activityId,
  polyline,
  color,
  colorEnd,
  showTracer = false,
  averageSpeed = 0,
  maxSpeed = 0,
}: RouteGeometryProps) {
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);
  const controls = useRouteControls();

  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tracerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const capGlowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const capPulse = useRef(0);       // current pulse intensity 0→1
  const loopPause = useRef(0);      // seconds remaining in pause between loops
  const tracerOffset = useRef(-1e-4);   // accumulated tracer scroll offset (seeded slightly negative to avoid false wrap on first frame)

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

  // Smoothed points as Vector3 array
  const routeVectors = useMemo(() => {
    if (!rawPoints || rawPoints.length < 2) return null;

    if (!controls.smoothEnabled || rawPoints.length < 3) {
      return rawPoints.map(([x, y]) => new THREE.Vector3(x, y, 0));
    }

    // Catmull-Rom spline interpolation
    const curve = new THREE.CatmullRomCurve3(
      rawPoints.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      "catmullrom",
      controls.smoothTension
    );
    const totalSegments = rawPoints.length * controls.smoothSubdivisions;
    return curve.getPoints(totalSegments);
  }, [rawPoints, controls.smoothEnabled, controls.smoothTension, controls.smoothSubdivisions]);

  // Piecewise-linear curve through the smoothed points
  const curve = useMemo(() => {
    if (!routeVectors || routeVectors.length < 2) return null;
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < routeVectors.length - 1; i++) {
      path.add(new THREE.LineCurve3(routeVectors[i], routeVectors[i + 1]));
    }
    return path;
  }, [routeVectors]);

  // Tube geometries — circular cross-section, no viewport dependency
  const segmentCount = routeVectors ? routeVectors.length : 0;

  // Helper: stamp per-vertex RGBA gradient onto a TubeGeometry.
  // RGB = pace color gradient, A = opacity fade along the tube.
  // Using 4-component vertex colors triggers USE_COLOR_ALPHA in three.js
  // which multiplies diffuseColor by vColor (including alpha), avoiding
  // alphaMap texture issues with TubeGeometry's circumferential UV wrap.
  const endCol = colorEnd ?? color;
  const alphaStops: [number, number][] = [
    [0, 0],
    [controls.gradPeakPoint, 1],
    [1, controls.gradEndAlpha],
  ];
  const applyVertexGradient = (geo: THREE.TubeGeometry) => {
    const uvs = geo.attributes.uv;
    const rgba = new Float32Array(uvs.count * 4);
    for (let i = 0; i < uvs.count; i++) {
      const u = uvs.getX(i);
      // Color gradient
      rgba[i * 4 + 0] = color.r + (endCol.r - color.r) * u;
      rgba[i * 4 + 1] = color.g + (endCol.g - color.g) * u;
      rgba[i * 4 + 2] = color.b + (endCol.b - color.b) * u;
      // Alpha fade — piecewise linear through the same stops as the old alphaMap
      let alpha = 0;
      for (let s = 0; s < alphaStops.length - 1; s++) {
        if (u <= alphaStops[s + 1][0]) {
          const len = alphaStops[s + 1][0] - alphaStops[s][0];
          const t = len > 0 ? (u - alphaStops[s][0]) / len : 0;
          alpha = alphaStops[s][1] + (alphaStops[s + 1][1] - alphaStops[s][1]) * t;
          break;
        }
      }
      rgba[i * 4 + 3] = alpha;
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(rgba, 4));
  };

  const glowGeo = useMemo(() => {
    if (!curve || !segmentCount) return null;
    const geo = new THREE.TubeGeometry(curve, segmentCount, controls.glowWidth / 2, RADIAL_SEGMENTS, false);
    applyVertexGradient(geo);
    return geo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, segmentCount, controls.glowWidth, color, colorEnd, controls.gradPeakPoint, controls.gradEndAlpha]);

  const coreGeo = useMemo(() => {
    if (!curve || !segmentCount) return null;
    const geo = new THREE.TubeGeometry(curve, segmentCount, controls.coreWidth / 2, RADIAL_SEGMENTS, false);
    applyVertexGradient(geo);
    return geo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, segmentCount, controls.coreWidth, color, colorEnd, controls.gradPeakPoint, controls.gradEndAlpha]);

  const tracerGeo = useMemo(() => {
    if (!curve || !segmentCount) return null;
    const geo = new THREE.TubeGeometry(curve, segmentCount, controls.tracerWidth / 2, RADIAL_SEGMENTS, false);
    applyVertexGradient(geo);
    return geo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, segmentCount, controls.tracerWidth, color, colorEnd, controls.gradPeakPoint, controls.gradEndAlpha]);

  // Single-color derivatives — used for start/end caps
  const coreColor = useMemo(
    () => color.clone().multiplyScalar(controls.coreBrightness),
    [color, controls.coreBrightness]
  );
  const glowColorVal = useMemo(
    () => color.clone().multiplyScalar(controls.glowBrightness),
    [color, controls.glowBrightness]
  );
  const coreColorEnd = useMemo(
    () => endCol.clone().multiplyScalar(controls.coreBrightness),
    [endCol, controls.coreBrightness]
  );
  const glowColorEnd = useMemo(
    () => endCol.clone().multiplyScalar(controls.glowBrightness),
    [endCol, controls.glowBrightness]
  );

  // Brightness-only colors — vertex colors × brightness scalar = final color
  const coreBrightnessColor = useMemo(
    () => new THREE.Color(controls.coreBrightness, controls.coreBrightness, controls.coreBrightness),
    [controls.coreBrightness]
  );
  const glowBrightnessColor = useMemo(
    () => new THREE.Color(controls.glowBrightness, controls.glowBrightness, controls.glowBrightness),
    [controls.glowBrightness]
  );

  // Dash alpha texture for tracer — scrolled via offset.x each frame
  // Uses a high-res texture with smooth gaussian falloff to avoid aliasing
  const tracerAlphaMap = useMemo(() => {
    const W = 2048;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    // Gap region (alpha = 0)
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, W, 1);
    // Soft dash with gaussian-like falloff for smooth motion
    const dashLen = Math.max(4, Math.round(W * (1 - controls.tracerDashRatio)));
    const imgData = ctx.getImageData(0, 0, W, 1);
    const data = imgData.data;
    const center = dashLen / 2;
    const sigma = dashLen / 3; // falloff width — ~3σ covers the full dash
    for (let x = 0; x < dashLen; x++) {
      const dist = (x - center) / sigma;
      const alpha = Math.exp(-0.5 * dist * dist);
      const idx = x * 4;
      data[idx] = data[idx + 1] = data[idx + 2] = Math.round(alpha * 255);
      data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }, [controls.tracerDashRatio]);

  const firstPoint = useMemo(() => {
    if (!routeVectors || routeVectors.length < 1) return null;
    return routeVectors[0].clone();
  }, [routeVectors]);

  const lastPoint = useMemo(() => {
    if (!routeVectors || routeVectors.length < 2) return null;
    return routeVectors[routeVectors.length - 1].clone();
  }, [routeVectors]);

  // Reset tracer to the route origin whenever this card gains focus
  const prevShowTracer = useRef(false);
  useEffect(() => {
    if (showTracer && !prevShowTracer.current) {
      tracerOffset.current = -1e-4;
      loopPause.current = 0;
      capPulse.current = 0;
    }
    prevShowTracer.current = showTracer;
  }, [showTracer]);

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
    if (tracerMatRef.current) {
      tracerMatRef.current.userData.skipVisibility = true;

      // Fade tracer out/in during the loop gap
      // 1.2→0.9: fade out | 0.9→0.3: hold invisible | 0.3→0: fade in
      let tracerFade = 1;
      if (loopPause.current > 0) {
        loopPause.current = Math.max(0, loopPause.current - delta);
        const p = loopPause.current;
        if (p > 0.9) tracerFade = (p - 0.9) / 0.3;       // fading out (1→0)
        else if (p > 0.3) tracerFade = 0;                  // invisible
        else tracerFade = 1 - p / 0.3;                     // fading in (0→1)

      } else if (!prefersReducedMotion) {
        // Only advance when not in the loop pause
        const prevOff = tracerOffset.current;
        tracerOffset.current -= delta * controls.tracerSpeed;

        // Detect tracer reaching the route end → trigger gap + cap pulse.
        // Check BEFORE applying offset to the texture so the wrapped dash
        // is never rendered even for a single frame.
        const dashWidth = 1 - controls.tracerDashRatio;
        const prevProgress = ((-prevOff % 1) + 1) % 1;
        const currProgress = ((-tracerOffset.current % 1) + 1) % 1;
        if (currProgress >= 1 - dashWidth && prevProgress < 1 - dashWidth) {
          loopPause.current = 1.2; // total gap duration
          capPulse.current = 1;
          tracerOffset.current = -1e-4;
        }

        tracerAlphaMap.offset.x = tracerOffset.current;
      }

      tracerMatRef.current.userData.baseOpacity = controls.tracerOpacity * tracerFade;
    }
    if (capGlowMatRef.current) {
      // Decay pulse
      capPulse.current = Math.max(0, capPulse.current - delta * 3.0);
      const pulseBoost = capPulse.current * 0.6; // peak adds 0.6 opacity
      capGlowMatRef.current.userData.baseOpacity = controls.capGlowOpacity + pulseBoost;
    }
  }, -1);

  if (!routeVectors || routeVectors.length < 2) return null;

  return (
    <group>
      {/* Soft glow halo */}
      {glowGeo && (
        <mesh renderOrder={0} geometry={glowGeo}>
          <meshBasicMaterial
            ref={glowMatRef}
            transparent
            vertexColors
            color={glowBrightnessColor}
            toneMapped={false}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            opacity={controls.glowOpacity}
          />
        </mesh>
      )}

      {/* Core line */}
      {coreGeo && (
        <mesh renderOrder={1} geometry={coreGeo}>
          <meshBasicMaterial
            ref={coreMatRef}
            transparent
            vertexColors
            color={coreBrightnessColor}
            toneMapped={false}
            depthWrite={true}
            depthTest={true}
            blending={THREE.NormalBlending}
            opacity={controls.coreOpacity}
          />
        </mesh>
      )}

      {/* Tracer spark — only on the focused route */}
      {controls.tracerEnabled && showTracer && tracerGeo && (
        <mesh renderOrder={2} geometry={tracerGeo}>
          <meshBasicMaterial
            ref={tracerMatRef}
            transparent
            vertexColors
            color={coreBrightnessColor}
            toneMapped={false}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            opacity={controls.tracerOpacity}
            alphaMap={tracerAlphaMap}
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

      {/* End cap */}
      {controls.capEnabled && lastPoint && (
        <>
          <mesh position={lastPoint} renderOrder={0} geometry={glowCapGeo}>
            <meshBasicMaterial
              transparent
              color={glowColorEnd}
              toneMapped={false}
              depthWrite={false}
              depthTest={false}
              blending={THREE.AdditiveBlending}
              opacity={controls.capGlowOpacity}
            />
          </mesh>
          <mesh position={lastPoint} renderOrder={1} geometry={coreCapGeo}>
            <meshBasicMaterial
              transparent
              color={coreColorEnd}
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

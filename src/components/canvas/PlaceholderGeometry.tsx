"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROUTE_DEFAULTS as D } from "./routeDefaults";

const RING_RADIUS = 1.2;
const RING_POINTS = 80;
const RADIAL_SEGMENTS = 6;

interface PlaceholderGeometryProps {
  color: THREE.Color;
  colorEnd?: THREE.Color;
  showTracer?: boolean;
}

export function PlaceholderGeometry({
  color,
  colorEnd,
  showTracer = false,
}: PlaceholderGeometryProps) {
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tracerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const capGlowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const capPulse = useRef(0);
  const loopPause = useRef(0);
  const tracerOffset = useRef(-1e-4);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Closed circular curve in XY plane (faces camera at +Z)
  const ringCurve = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < RING_POINTS; i++) {
      const angle = -(i / RING_POINTS) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * RING_RADIUS,
          Math.sin(angle) * RING_RADIUS,
          0
        )
      );
    }
    return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
  }, []);

  const endCol = colorEnd ?? color;

  // Brightness-only scalars — vertex colors × brightness = final color
  const coreBrightnessColor = useMemo(
    () =>
      new THREE.Color(D.coreBrightness, D.coreBrightness, D.coreBrightness),
    []
  );
  const glowBrightnessColor = useMemo(
    () =>
      new THREE.Color(D.glowBrightness, D.glowBrightness, D.glowBrightness),
    []
  );

  // Single-color derivatives for start cap
  const coreColor = useMemo(
    () => color.clone().multiplyScalar(D.coreBrightness),
    [color]
  );
  const glowColorVal = useMemo(
    () => color.clone().multiplyScalar(D.glowBrightness),
    [color]
  );

  // Stamp per-vertex RGBA: RGB = pace color gradient, A = alpha fade along the tube
  const alphaStops: [number, number][] = useMemo(
    () => [
      [0, 1],
      [D.gradHoldEnd, 1],
      [D.gradMidPoint, D.gradMidAlpha],
      [D.gradTailPoint, D.gradTailAlpha],
      [1, 0],
    ],
    []
  );

  const applyVertexGradient = useMemo(
    () => (geo: THREE.TubeGeometry) => {
      const uvs = geo.attributes.uv;
      const rgba = new Float32Array(uvs.count * 4);
      for (let i = 0; i < uvs.count; i++) {
        const u = uvs.getX(i);
        rgba[i * 4 + 0] = color.r + (endCol.r - color.r) * u;
        rgba[i * 4 + 1] = color.g + (endCol.g - color.g) * u;
        rgba[i * 4 + 2] = color.b + (endCol.b - color.b) * u;
        let alpha = 0;
        for (let s = 0; s < alphaStops.length - 1; s++) {
          if (u <= alphaStops[s + 1][0]) {
            const len = alphaStops[s + 1][0] - alphaStops[s][0];
            const t = len > 0 ? (u - alphaStops[s][0]) / len : 0;
            alpha =
              alphaStops[s][1] +
              (alphaStops[s + 1][1] - alphaStops[s][1]) * t;
            break;
          }
        }
        rgba[i * 4 + 3] = alpha;
      }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(rgba, 4));
    },
    [color, endCol, alphaStops]
  );

  // Tube geometries (closed ring)
  const glowGeo = useMemo(() => {
    const geo = new THREE.TubeGeometry(
      ringCurve,
      RING_POINTS,
      D.glowWidth / 2,
      RADIAL_SEGMENTS,
      true
    );
    applyVertexGradient(geo);
    return geo;
  }, [ringCurve, applyVertexGradient]);

  const coreGeo = useMemo(() => {
    const geo = new THREE.TubeGeometry(
      ringCurve,
      RING_POINTS,
      D.coreWidth / 2,
      RADIAL_SEGMENTS,
      true
    );
    applyVertexGradient(geo);
    return geo;
  }, [ringCurve, applyVertexGradient]);

  const tracerGeo = useMemo(() => {
    const geo = new THREE.TubeGeometry(
      ringCurve,
      RING_POINTS,
      D.tracerWidth / 2,
      RADIAL_SEGMENTS,
      true
    );
    applyVertexGradient(geo);
    return geo;
  }, [ringCurve, applyVertexGradient]);

  // Tracer dash alphaMap — scrolled via offset.x each frame
  const tracerAlphaMap = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 512, 1);
    const dashLen = Math.floor(512 * (1 - D.tracerDashRatio));
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, dashLen, 1);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Start cap at angle=0 (rightmost point of ring)
  const firstPoint = useMemo(
    () => new THREE.Vector3(RING_RADIUS, 0, 0),
    []
  );

  const glowCapGeo = useMemo(
    () => new THREE.SphereGeometry(D.capGlowRadius, 16, 16),
    []
  );
  const coreCapGeo = useMemo(
    () => new THREE.SphereGeometry(D.capCoreRadius, 12, 12),
    []
  );

  // Reset tracer when this card gains focus
  const prevShowTracer = useRef(false);
  useEffect(() => {
    if (showTracer && !prevShowTracer.current) {
      tracerOffset.current = -1e-4;
      loopPause.current = 0;
      capPulse.current = 0;
    }
    prevShowTracer.current = showTracer;
  }, [showTracer]);

  // Priority -1 so base opacities are set BEFORE RunCard's visibility traverse
  useFrame(({ clock }, delta) => {
    if (coreMatRef.current) {
      coreMatRef.current.userData.baseOpacity = D.coreOpacity;
    }
    if (glowMatRef.current) {
      const breathe =
        !prefersReducedMotion && D.glowBreatheSpeed > 0
          ? D.glowOpacity +
            Math.sin(clock.elapsedTime * D.glowBreatheSpeed) *
              D.glowBreatheAmount
          : D.glowOpacity;
      glowMatRef.current.userData.baseOpacity = breathe;
    }
    if (tracerMatRef.current) {
      tracerMatRef.current.userData.skipVisibility = true;

      let tracerFade = 1;
      if (loopPause.current > 0) {
        loopPause.current = Math.max(0, loopPause.current - delta);
        const p = loopPause.current;
        if (p > 0.9) tracerFade = (p - 0.9) / 0.3;
        else if (p > 0.3) tracerFade = 0;
        else tracerFade = 1 - p / 0.3;
      } else if (!prefersReducedMotion) {
        const prevOff = tracerOffset.current;
        tracerOffset.current -= delta * D.tracerSpeed;

        const dashWidth = 1 - D.tracerDashRatio;
        const prevProgress = ((-prevOff % 1) + 1) % 1;
        const currProgress = ((-tracerOffset.current % 1) + 1) % 1;
        if (
          currProgress >= 1 - dashWidth &&
          prevProgress < 1 - dashWidth
        ) {
          loopPause.current = 1.2;
          capPulse.current = 1;
          tracerOffset.current = -1e-4;
        }

        tracerAlphaMap.offset.x = tracerOffset.current;
      }

      tracerMatRef.current.userData.baseOpacity =
        D.tracerOpacity * tracerFade;
    }
    if (capGlowMatRef.current) {
      capPulse.current = Math.max(0, capPulse.current - delta * 3.0);
      const pulseBoost = capPulse.current * 0.6;
      capGlowMatRef.current.userData.baseOpacity =
        D.capGlowOpacity + pulseBoost;
    }
  }, -1);

  return (
    <group>
      {/* Soft glow halo */}
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
          opacity={D.glowOpacity}
        />
      </mesh>

      {/* Core ring */}
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
          opacity={D.coreOpacity}
        />
      </mesh>

      {/* Tracer spark — only when focused */}
      {showTracer && (
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
            opacity={D.tracerOpacity}
            alphaMap={tracerAlphaMap}
          />
        </mesh>
      )}

      {/* Start cap */}
      <mesh position={firstPoint} renderOrder={0} geometry={glowCapGeo}>
        <meshBasicMaterial
          ref={capGlowMatRef}
          transparent
          color={glowColorVal}
          toneMapped={false}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          opacity={D.capGlowOpacity}
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
    </group>
  );
}

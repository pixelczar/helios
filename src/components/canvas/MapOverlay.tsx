"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { fetchMapImage } from "@/lib/geo/mapTiles";

const BASE_OPACITY = 0.95;
const FADE_SPEED = 1.5; // per second — reaches full in ~430ms
const TINT_AMOUNT = 0.4; // how far the streets lean toward the run's pace color

interface MapOverlayProps {
  activityId: number;
  tint: THREE.Color;
  rawPoints: [number, number][];
  normParams: {
    centerLat: number;
    centerLng: number;
    cosLat: number;
    scale: number;
  };
}

export function MapOverlay({ activityId, tint, rawPoints, normParams }: MapOverlayProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [planeBounds, setPlaneBounds] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);
  const fadeProgress = useRef(0);

  useEffect(() => {
    let cancelled = false;
    // Free the GPU copy when the card leaves the map window — the source
    // canvas stays in mapTiles' cache, so coming back is a cheap re-upload
    let created: THREE.CanvasTexture | null = null;

    fetchMapImage(activityId, rawPoints).then((result) => {
      if (cancelled || !result) return;

      const { canvas, coverage } = result;
      const { centerLat, centerLng, cosLat, scale } = normParams;

      // Convert tile bounds to normalized route coordinates
      const minX = (coverage.bounds.minLng - centerLng) * cosLat * scale;
      const maxX = (coverage.bounds.maxLng - centerLng) * cosLat * scale;
      const minY = (coverage.bounds.minLat - centerLat) * scale;
      const maxY = (coverage.bounds.maxLat - centerLat) * scale;

      const width = maxX - minX;
      const height = maxY - minY;
      const x = (minX + maxX) / 2;
      const y = (minY + maxY) / 2;

      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
      tex.colorSpace = THREE.SRGBColorSpace;

      created = tex;
      setTexture(tex);
      setPlaneBounds({ width, height, x, y });
    });

    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [activityId, rawPoints, normParams]);

  // Animate userData.baseOpacity from 0 → BASE_OPACITY so RunCard's
  // visibility traverse multiplies against the fading-in value.
  // Always write (not just during fade) because React re-renders reset userData.
  useFrame((_, delta) => {
    if (!matRef.current) return;
    if (fadeProgress.current < BASE_OPACITY) {
      fadeProgress.current = Math.min(BASE_OPACITY, fadeProgress.current + delta * FADE_SPEED);
    }
    matRef.current.userData.baseOpacity = fadeProgress.current;
  });

  // Material color multiplies the texture — a light wash of the pace color
  // gives each run's streets its own mood without competing with the line
  const tintColor = useMemo(
    () => new THREE.Color(1, 1, 1).lerp(tint, TINT_AMOUNT),
    [tint]
  );

  const planeGeo = useMemo(() => {
    if (!planeBounds) return null;
    return new THREE.PlaneGeometry(planeBounds.width, planeBounds.height);
  }, [planeBounds]);

  if (!texture || !planeBounds || !planeGeo) return null;

  return (
    <mesh
      position={[planeBounds.x, planeBounds.y, -0.01]}
      geometry={planeGeo}
      renderOrder={-1}
    >
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        color={tintColor}
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        blending={THREE.NormalBlending}
        userData={{ baseOpacity: 0 }}
      />
    </mesh>
  );
}

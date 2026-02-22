"use client";

import { useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { fetchMapImage } from "@/lib/geo/mapTiles";

interface MapOverlayProps {
  activityId: number;
  rawPoints: [number, number][];
  normParams: {
    centerLat: number;
    centerLng: number;
    cosLat: number;
    scale: number;
  };
}

export function MapOverlay({ activityId, rawPoints, normParams }: MapOverlayProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [planeBounds, setPlaneBounds] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

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

      setTexture(tex);
      setPlaneBounds({ width, height, x, y });
    });

    return () => {
      cancelled = true;
    };
  }, [activityId, rawPoints, normParams]);

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
        map={texture}
        transparent
        opacity={0.65}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        blending={THREE.NormalBlending}
        userData={{ baseOpacity: 0.65 }}
      />
    </mesh>
  );
}

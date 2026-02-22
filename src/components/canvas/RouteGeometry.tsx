"use client";

import { useMemo, useRef } from "react";
import { extend } from "@react-three/fiber";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";
import { decodePolyline } from "@/lib/geo/polyline";
import { normalizeRoute } from "@/lib/geo/normalize";
import { simplifyRoute } from "@/lib/geo/simplify";
import { useActivityStore } from "@/stores/activityStore";

extend({ MeshLineGeometry, MeshLineMaterial });


interface RouteGeometryProps {
  activityId: number;
  polyline: string | null;
  color: THREE.Color;
  materialRef?: React.RefObject<MeshLineMaterial | null>;
}

export function RouteGeometry({
  activityId,
  polyline,
  color,
  materialRef,
}: RouteGeometryProps) {
  const internalMatRef = useRef<MeshLineMaterial>(null);
  const matRef = materialRef || internalMatRef;
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);

  const linePoints = useMemo(() => {
    // Check cache first
    const cached = decodedRoutes.get(activityId);
    if (cached && cached.normalized.length > 0) {
      return cached.normalized.flatMap(([x, y]) => [x, y, 0]);
    }

    if (!polyline) return null;

    const decoded = decodePolyline(polyline);
    if (decoded.length < 2) return null;

    const simplified = decoded.length > 500 ? simplifyRoute(decoded) : decoded;
    const normalized = normalizeRoute(simplified);
    return normalized.flatMap(([x, y]) => [x, y, 0]);
  }, [activityId, polyline, decodedRoutes]);

  // Bloom-ready color (multiply intensity for glow pickup)
  const bloomColor = useMemo(() => color.clone().multiplyScalar(2.5), [color]);

  if (!linePoints || linePoints.length < 6) return null;

  return (
    <mesh>
      {/* @ts-expect-error meshline types */}
      <meshLineGeometry points={linePoints} />
      {/* @ts-expect-error meshline types */}
      <meshLineMaterial
        ref={matRef}
        transparent
        lineWidth={0.12}
        color={bloomColor}
        toneMapped={false}
        depthWrite={false}
        opacity={1}
      />
    </mesh>
  );
}

// Outer glow halo line (rendered behind the main line)
export function RouteGlow({
  activityId,
  polyline,
  color,
  opacity = 0.15,
}: {
  activityId: number;
  polyline: string | null;
  color: THREE.Color;
  opacity?: number;
}) {
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);

  const linePoints = useMemo(() => {
    const cached = decodedRoutes.get(activityId);
    if (cached && cached.normalized.length > 0) {
      return cached.normalized.flatMap(([x, y]) => [x, y, 0]);
    }

    if (!polyline) return null;
    const decoded = decodePolyline(polyline);
    if (decoded.length < 2) return null;
    const simplified = decoded.length > 500 ? simplifyRoute(decoded) : decoded;
    const normalized = normalizeRoute(simplified);
    return normalized.flatMap(([x, y]) => [x, y, 0]);
  }, [activityId, polyline, decodedRoutes]);

  const bloomColor = useMemo(() => color.clone().multiplyScalar(1.5), [color]);

  if (!linePoints || linePoints.length < 6) return null;

  return (
    <mesh>
      {/* @ts-expect-error meshline types */}
      <meshLineGeometry points={linePoints} />
      {/* @ts-expect-error meshline types */}
      <meshLineMaterial
        transparent
        lineWidth={0.4}
        color={bloomColor}
        toneMapped={false}
        depthWrite={false}
        opacity={opacity}
      />
    </mesh>
  );
}

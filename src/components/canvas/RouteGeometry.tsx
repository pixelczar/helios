"use client";

import { useMemo, useRef } from "react";
import { extend, useFrame } from "@react-three/fiber";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";
import { decodePolyline } from "@/lib/geo/polyline";
import { normalizeRoute } from "@/lib/geo/normalize";
import { simplifyRoute } from "@/lib/geo/simplify";
import { useActivityStore } from "@/stores/activityStore";

extend({ MeshLineGeometry, MeshLineMaterial });

// Shared geometries for endpoint caps
const GLOW_CAP_GEO = new THREE.SphereGeometry(0.125, 12, 12);
const CORE_CAP_GEO = new THREE.SphereGeometry(0.04, 12, 12);

interface RouteGeometryProps {
  activityId: number;
  polyline: string | null;
  color: THREE.Color;
}

export function RouteGeometry({
  activityId,
  polyline,
  color,
}: RouteGeometryProps) {
  const decodedRoutes = useActivityStore((s) => s.decodedRoutes);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pulseMatRef = useRef<any>(null);

  const linePoints = useMemo(() => {
    const cached = decodedRoutes.get(activityId);
    if (cached && cached.normalized.length > 0) {
      return cached.normalized.flatMap(([x, y]) => [x, y, 0]);
    }

    if (!polyline) return null;

    const decoded = decodePolyline(polyline);
    if (decoded.length < 2) return null;

    const simplified = decoded.length > 500 ? simplifyRoute(decoded) : decoded;
    const normalized = normalizeRoute(simplified, 8);
    return normalized.flatMap(([x, y]) => [x, y, 0]);
  }, [activityId, polyline, decodedRoutes]);

  const bloomColor = useMemo(() => color.clone().multiplyScalar(2.0), [color]);

  // Endpoint positions for rounded caps
  const { firstPoint, lastPoint } = useMemo(() => {
    if (!linePoints || linePoints.length < 6) {
      return { firstPoint: null, lastPoint: null };
    }
    return {
      firstPoint: new THREE.Vector3(linePoints[0], linePoints[1], linePoints[2]),
      lastPoint: new THREE.Vector3(
        linePoints[linePoints.length - 3],
        linePoints[linePoints.length - 2],
        linePoints[linePoints.length - 1]
      ),
    };
  }, [linePoints]);

  // Animate the direction pulse
  useFrame((_, delta) => {
    if (pulseMatRef.current) {
      pulseMatRef.current.dashOffset -= delta * 0.08;
    }
  });

  if (!linePoints || linePoints.length < 6) return null;

  return (
    <group>
      {/* Outer glow — wide, soft, additive blended */}
      <mesh renderOrder={0}>
        {/* @ts-expect-error meshline types */}
        <meshLineGeometry points={linePoints} />
        {/* @ts-expect-error meshline types */}
        <meshLineMaterial
          transparent
          lineWidth={0.25}
          color={bloomColor}
          toneMapped={false}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          opacity={0.15}
          userData={{ baseOpacity: 0.15 }}
        />
      </mesh>

      {/* Core line — sharp, bright, normal blended to avoid overlap artifacts */}
      <mesh renderOrder={1}>
        {/* @ts-expect-error meshline types */}
        <meshLineGeometry points={linePoints} />
        {/* @ts-expect-error meshline types */}
        <meshLineMaterial
          transparent
          lineWidth={0.08}
          color={bloomColor}
          toneMapped={false}
          depthWrite={true}
          depthTest={true}
          blending={THREE.NormalBlending}
          opacity={0.9}
          userData={{ baseOpacity: 0.9 }}
        />
      </mesh>

      {/* Direction pulse — traveling bright segment */}
      <mesh renderOrder={2}>
        {/* @ts-expect-error meshline types */}
        <meshLineGeometry points={linePoints} />
        {/* @ts-expect-error meshline types */}
        <meshLineMaterial
          ref={pulseMatRef}
          transparent
          lineWidth={0.06}
          color={bloomColor}
          toneMapped={false}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          opacity={0.4}
          dashArray={1.0}
          dashRatio={0.9}
          dashOffset={0}
          userData={{ baseOpacity: 0.4 }}
        />
      </mesh>

      {/* Rounded endpoint caps */}
      {firstPoint && (
        <>
          <mesh position={firstPoint} renderOrder={0} geometry={GLOW_CAP_GEO}>
            <meshBasicMaterial
              transparent
              color={bloomColor}
              toneMapped={false}
              depthWrite={false}
              depthTest={false}
              blending={THREE.AdditiveBlending}
              opacity={0.15}
              userData={{ baseOpacity: 0.15 }}
            />
          </mesh>
          <mesh position={firstPoint} renderOrder={1} geometry={CORE_CAP_GEO}>
            <meshBasicMaterial
              transparent
              color={bloomColor}
              toneMapped={false}
              depthWrite={true}
              depthTest={true}
              blending={THREE.NormalBlending}
              opacity={0.9}
              userData={{ baseOpacity: 0.9 }}
            />
          </mesh>
        </>
      )}
      {lastPoint && (
        <>
          <mesh position={lastPoint} renderOrder={0} geometry={GLOW_CAP_GEO}>
            <meshBasicMaterial
              transparent
              color={bloomColor}
              toneMapped={false}
              depthWrite={false}
              depthTest={false}
              blending={THREE.AdditiveBlending}
              opacity={0.15}
              userData={{ baseOpacity: 0.15 }}
            />
          </mesh>
          <mesh position={lastPoint} renderOrder={1} geometry={CORE_CAP_GEO}>
            <meshBasicMaterial
              transparent
              color={bloomColor}
              toneMapped={false}
              depthWrite={true}
              depthTest={true}
              blending={THREE.NormalBlending}
              opacity={0.9}
              userData={{ baseOpacity: 0.9 }}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

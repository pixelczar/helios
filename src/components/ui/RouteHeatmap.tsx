"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

const EASE = [0.25, 0.1, 0.25, 1] as const;

// The map lives in its own band of the screen — between the headline stats
// up top and the recent-runs row at the bottom — as fractions of the
// viewport. The core of the year's routes (robust percentile bounds) is
// fitted and centered in this frame; one-off runs out of town spill past it
// and fade into the falloff instead of shrinking the home streets.
const FRAME = { cx: 0.5, cy: 0.59, w: 0.5, h: 0.36 };
const LINE_ALPHA = 0.14;

export interface HeatmapRoute {
  id: number;
  points: [number, number][]; // [lat, lng]
  color: string;
}

interface RouteHeatmapProps {
  routes: HeatmapRoute[];
  highlightId: number | null;
  reducedMotion: boolean | null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

/**
 * Every route of the year stacked on one canvas with additive blending —
 * streets you run often glow brighter where the lines pile up. Each route
 * keeps its pace color. The hovered recent run is redrawn on top at full
 * strength.
 */
export function RouteHeatmap({ routes, highlightId, reducedMotion }: RouteHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Equirectangular projection, scaled so the 5th–95th percentile spread
  // fits the viewport
  const projection = useMemo(() => {
    const lats: number[] = [];
    const lngs: number[] = [];
    for (const r of routes) {
      for (let i = 0; i < r.points.length; i += 4) {
        lats.push(r.points[i][0]);
        lngs.push(r.points[i][1]);
      }
    }
    if (lats.length === 0) return null;
    lats.sort((a, b) => a - b);
    lngs.sort((a, b) => a - b);
    // Center on the middle of the 5th–95th percentile box (the median sits
    // wherever runs are densest, which pulls the picture off-center)
    const latLo = percentile(lats, 0.05), latHi = percentile(lats, 0.95);
    const lngLo = percentile(lngs, 0.05), lngHi = percentile(lngs, 0.95);
    const midLat = (latLo + latHi) / 2;
    const midLng = (lngLo + lngHi) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180);
    const spanY = latHi - latLo;
    const spanX = (lngHi - lngLo) * cosLat;
    return { midLat, midLng, cosLat, spanX: spanX || 0.01, spanY: spanY || 0.01 };
  }, [routes]);

  const toScreen = useMemo(() => {
    if (!projection || !size) return null;
    const { midLat, midLng, cosLat, spanX, spanY } = projection;
    const scale = Math.min((size.w * FRAME.w) / spanX, (size.h * FRAME.h) / spanY);
    const cx = size.w * FRAME.cx;
    const cy = size.h * FRAME.cy;
    return (lat: number, lng: number): [number, number] => [
      cx + (lng - midLng) * cosLat * scale,
      cy - (lat - midLat) * scale,
    ];
  }, [projection, size]);

  // Static layer — drawn once per data/size change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size || !toScreen) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 1.1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = LINE_ALPHA;
    for (const r of routes) {
      if (r.points.length < 2) continue;
      ctx.strokeStyle = r.color;
      ctx.beginPath();
      r.points.forEach(([lat, lng], i) => {
        const [x, y] = toScreen(lat, lng);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [routes, size, toScreen]);

  const highlight = routes.find((r) => r.id === highlightId);
  // The on-pace band is a dim neutral — fine stacked in the heatmap, too
  // quiet for the one route being pointed at
  const highlightColor = highlight?.color === "#555555" ? "#e5e5e5" : highlight?.color;
  const highlightPath = useMemo(() => {
    if (!highlight || !toScreen) return null;
    return highlight.points
      .map(([lat, lng], i) => {
        const [x, y] = toScreen(lat, lng);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join("");
  }, [highlight, toScreen]);

  return (
    // Opaque: the dashboard fully covers the 3D scene (so runs don't show
    // through mid-transition, and the scene can stop rendering underneath)
    <div className="absolute inset-0 bg-black" aria-hidden="true">
      <motion.canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.03 }}
        animate={{ opacity: highlightId ? 0.55 : 1, scale: 1 }}
        transition={{ opacity: { duration: highlightId ? 0.3 : 1.6, ease: EASE }, scale: { duration: 2.2, ease: EASE } }}
      />

      {/* Falloff — the map fades out past its frame */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(ellipse 48% 42% at ${FRAME.cx * 100}% ${FRAME.cy * 100}%, transparent 55%, rgba(0,0,0,0.85) 100%)`,
        }}
      />

      {/* Hovered recent run — above the falloff, at full strength */}
      {size && highlight && highlightPath && (
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size.w} ${size.h}`}>
          <motion.path
            key={highlight.id}
            d={highlightPath}
            fill="none"
            stroke={highlightColor}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${highlightColor})` }}
            initial={{ pathLength: reducedMotion ? 1 : 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.7, ease: EASE }}
          />
        </svg>
      )}
    </div>
  );
}

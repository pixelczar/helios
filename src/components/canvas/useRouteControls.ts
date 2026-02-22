"use client";

import { useRef } from "react";
import { useControls, folder, button } from "leva";
import { ROUTE_DEFAULTS as D } from "./routeDefaults";

export function useRouteControls() {
  const core = useControls("Route", {
    Core: folder({
      coreWidth: { value: D.coreWidth, min: 0.005, max: 0.15, step: 0.001, label: "Width" },
      coreOpacity: { value: D.coreOpacity, min: 0, max: 1, step: 0.01, label: "Opacity" },
      coreBrightness: { value: D.coreBrightness, min: 0.5, max: 8, step: 0.1, label: "Brightness" },
    }),
  });

  const glow = useControls("Route", {
    Glow: folder({
      glowWidth: { value: D.glowWidth, min: 0.01, max: 0.4, step: 0.005, label: "Width" },
      glowOpacity: { value: D.glowOpacity, min: 0, max: 1, step: 0.01, label: "Opacity" },
      glowBrightness: { value: D.glowBrightness, min: 0.5, max: 6, step: 0.1, label: "Brightness" },
      glowBreatheSpeed: { value: D.glowBreatheSpeed, min: 0, max: 5, step: 0.1, label: "Breathe Speed" },
      glowBreatheAmount: { value: D.glowBreatheAmount, min: 0, max: 0.2, step: 0.005, label: "Breathe Amt" },
    }),
  });

  const tracer = useControls("Route", {
    Tracer: folder({
      tracerEnabled: { value: D.tracerEnabled, label: "Enabled" },
      tracerWidth: { value: D.tracerWidth, min: 0.01, max: 0.15, step: 0.005, label: "Width" },
      tracerOpacity: { value: D.tracerOpacity, min: 0, max: 1, step: 0.01, label: "Opacity" },
      tracerSpeed: { value: D.tracerSpeed, min: 0.01, max: 2, step: 0.01, label: "Speed" },
      tracerDashArray: { value: D.tracerDashArray, min: 0.1, max: 2, step: 0.05, label: "Dash Length" },
      tracerDashRatio: { value: D.tracerDashRatio, min: 0.5, max: 0.99, step: 0.01, label: "Dash Ratio" },
    }),
  });

  const gradient = useControls("Route", {
    Gradient: folder({
      gradHoldEnd: { value: D.gradHoldEnd, min: 0, max: 0.8, step: 0.01, label: "Hold End" },
      gradMidPoint: { value: D.gradMidPoint, min: 0.2, max: 0.9, step: 0.01, label: "Mid Point" },
      gradMidAlpha: { value: D.gradMidAlpha, min: 0, max: 1, step: 0.01, label: "Mid Alpha" },
      gradTailPoint: { value: D.gradTailPoint, min: 0.5, max: 0.98, step: 0.01, label: "Tail Point" },
      gradTailAlpha: { value: D.gradTailAlpha, min: 0, max: 0.5, step: 0.01, label: "Tail Alpha" },
    }),
  });

  const caps = useControls("Route", {
    "Start Cap": folder({
      capEnabled: { value: D.capEnabled, label: "Enabled" },
      capGlowRadius: { value: D.capGlowRadius, min: 0.02, max: 0.3, step: 0.005, label: "Glow Radius" },
      capGlowOpacity: { value: D.capGlowOpacity, min: 0, max: 1, step: 0.01, label: "Glow Opacity" },
      capCoreRadius: { value: D.capCoreRadius, min: 0.01, max: 0.1, step: 0.005, label: "Core Radius" },
    }),
  });

  const smoothing = useControls("Route", {
    Smoothing: folder({
      smoothEnabled: { value: D.smoothEnabled, label: "Enabled" },
      smoothTension: { value: D.smoothTension, min: 0, max: 1, step: 0.01, label: "Tension" },
      smoothSubdivisions: { value: D.smoothSubdivisions, min: 1, max: 10, step: 1, label: "Subdivisions" },
    }),
  });

  const all = { ...core, ...glow, ...tracer, ...gradient, ...caps, ...smoothing };
  const ref = useRef(all);
  ref.current = all;

  useControls("Route", {
    "Copy Route Defaults": button(() => {
      const v = ref.current;
      const src = generateDefaults(v);
      navigator.clipboard.writeText(src).then(() =>
        console.log("[leva] Copied routeDefaults.ts to clipboard")
      );
    }),
  });

  return all;
}

// Generates the full routeDefaults.ts file content with current values
function generateDefaults(v: ReturnType<typeof useRouteControls>): string {
  const n = (val: number) => Number(val.toPrecision(4));
  return `export const ROUTE_DEFAULTS = {
  // Core
  coreWidth: ${n(v.coreWidth)},
  coreOpacity: ${n(v.coreOpacity)},
  coreBrightness: ${n(v.coreBrightness)},

  // Glow
  glowWidth: ${n(v.glowWidth)},
  glowOpacity: ${n(v.glowOpacity)},
  glowBrightness: ${n(v.glowBrightness)},
  glowBreatheSpeed: ${n(v.glowBreatheSpeed)},
  glowBreatheAmount: ${n(v.glowBreatheAmount)},

  // Tracer
  tracerEnabled: ${v.tracerEnabled},
  tracerWidth: ${n(v.tracerWidth)},
  tracerOpacity: ${n(v.tracerOpacity)},
  tracerSpeed: ${n(v.tracerSpeed)},
  tracerDashArray: ${n(v.tracerDashArray)},
  tracerDashRatio: ${n(v.tracerDashRatio)},

  // Gradient
  gradHoldEnd: ${n(v.gradHoldEnd)},
  gradMidPoint: ${n(v.gradMidPoint)},
  gradMidAlpha: ${n(v.gradMidAlpha)},
  gradTailPoint: ${n(v.gradTailPoint)},
  gradTailAlpha: ${n(v.gradTailAlpha)},

  // Start Cap
  capEnabled: ${v.capEnabled},
  capGlowRadius: ${n(v.capGlowRadius)},
  capGlowOpacity: ${n(v.capGlowOpacity)},
  capCoreRadius: ${n(v.capCoreRadius)},

  // Smoothing
  smoothEnabled: ${v.smoothEnabled},
  smoothTension: ${n(v.smoothTension)},
  smoothSubdivisions: ${v.smoothSubdivisions},
};

export const POST_DEFAULTS = {
  intensity: 1.4,
  threshold: 0.15,
  smoothing: 0.9,
  vignetteOffset: 0.3,
  vignetteDarkness: 0.7,
};
`;
}

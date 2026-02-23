export const ROUTE_DEFAULTS = {
  // Core
  coreWidth: 0.016,
  coreOpacity: 1.0,
  coreBrightness: 1.5,

  // Glow
  glowWidth: 0.01,
  glowOpacity: 0.06,
  glowBrightness: 0.5,
  glowBreatheSpeed: 1.2,
  glowBreatheAmount: 0.2,

  // Tracer
  tracerEnabled: true,
  tracerWidth: 0.04,
  tracerOpacity: 0.85,
  tracerSpeed: 0.25,
  tracerDashArray: 1.0,
  tracerDashRatio: 0.97,

  // Gradient
  gradPeakPoint: 0.5,
  gradEndAlpha: 0.01,

  // Start Cap
  capEnabled: true,
  capGlowRadius: 0.04,
  capGlowOpacity: 0.12,
  capCoreRadius: 0.02,

  // Smoothing
  smoothEnabled: true,
  smoothTension: 0.08,
  smoothSubdivisions: 3,
};

export const POST_DEFAULTS = {
  intensity: 1.8,
  threshold: 0.52,
  smoothing: 0.16,
  vignetteOffset: 0.0,
  vignetteDarkness: 1.0,
};

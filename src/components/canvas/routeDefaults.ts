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
  gradHoldEnd: 0.3,
  gradMidPoint: 0.55,
  gradMidAlpha: 0.4,
  gradTailPoint: 0.8,
  gradTailAlpha: 0.08,

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

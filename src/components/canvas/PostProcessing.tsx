"use client";

import { useRef } from "react";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { HalfFloatType } from "three";
import { useControls, folder, button } from "leva";
import { POST_DEFAULTS as D } from "./routeDefaults";
import { useIsMobile } from "@/hooks/useMediaQuery";

export function PostProcessing() {
  const isMobile = useIsMobile();
  const values = useControls("Post Processing", {
    Bloom: folder({
      intensity: { value: D.intensity, min: 0, max: 5, step: 0.05, label: "Intensity" },
      threshold: { value: D.threshold, min: 0, max: 1, step: 0.01, label: "Threshold" },
      smoothing: { value: D.smoothing, min: 0, max: 1, step: 0.01, label: "Smoothing" },
    }),
    Vignette: folder({
      vignetteOffset: { value: D.vignetteOffset, min: 0, max: 1, step: 0.01, label: "Offset" },
      vignetteDarkness: { value: D.vignetteDarkness, min: 0, max: 1, step: 0.01, label: "Darkness" },
    }),
    Grain: folder({
      grainOpacity: { value: D.grainOpacity, min: 0, max: 0.3, step: 0.005, label: "Opacity" },
    }),
  });

  const ref = useRef(values);
  ref.current = values;

  useControls("Post Processing", {
    "Copy Post Defaults": button(() => {
      const v = ref.current;
      const n = (val: number) => Number(val.toPrecision(4));
      const snippet = `export const POST_DEFAULTS = {
  intensity: ${n(v.intensity)},
  threshold: ${n(v.threshold)},
  smoothing: ${n(v.smoothing)},
  vignetteOffset: ${n(v.vignetteOffset)},
  vignetteDarkness: ${n(v.vignetteDarkness)},
  grainOpacity: ${n(v.grainOpacity)},
};`;
      navigator.clipboard.writeText(snippet).then(() =>
        console.log("[leva] Copied POST_DEFAULTS to clipboard")
      );
    }),
  });

  return (
    // 4× MSAA (library default is 8×) — indistinguishable under bloom + grain,
    // roughly half the multisample cost at retina resolution
    <EffectComposer frameBufferType={HalfFloatType} multisampling={isMobile ? 0 : 4}>
      <Bloom
        intensity={isMobile ? values.intensity * 0.5 : values.intensity}
        luminanceThreshold={values.threshold}
        luminanceSmoothing={values.smoothing}
        mipmapBlur
      />
      <Vignette offset={values.vignetteOffset} darkness={values.vignetteDarkness} />
      {/* Fine grain — breaks up banding in the glow/vignette gradients */}
      <Noise
        premultiply
        blendFunction={BlendFunction.ADD}
        opacity={values.grainOpacity}
      />
    </EffectComposer>
  );
}

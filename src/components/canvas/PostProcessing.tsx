"use client";

import { useRef } from "react";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
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
};`;
      navigator.clipboard.writeText(snippet).then(() =>
        console.log("[leva] Copied POST_DEFAULTS to clipboard")
      );
    }),
  });

  return (
    <EffectComposer>
      <Bloom
        intensity={isMobile ? values.intensity * 0.5 : values.intensity}
        luminanceThreshold={values.threshold}
        luminanceSmoothing={values.smoothing}
        mipmapBlur
      />
      <Vignette offset={values.vignetteOffset} darkness={values.vignetteDarkness} />
    </EffectComposer>
  );
}

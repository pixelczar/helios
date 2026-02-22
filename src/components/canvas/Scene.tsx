"use client";

import { Canvas } from "@react-three/fiber";
import { ScrollControls, MapControls } from "@react-three/drei";
import { Suspense } from "react";
import { RunTimeline } from "./RunTimeline";
import { PostProcessing } from "./PostProcessing";
import { Background } from "./Background";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useIsMobile } from "@/hooks/useMediaQuery";

interface SceneProps {
  activityCount: number;
}

export function Scene({ activityCount }: SceneProps) {
  const pages = Math.max(activityCount, 2);
  const { theme } = useTheme();
  const bgColor = theme === "dark" ? "#050505" : "#f5f5f5";
  const isMobile = useIsMobile();

  return (
    <Canvas
      gl={{
        antialias: !isMobile,
        alpha: false,
        powerPreference: isMobile ? "default" : "high-performance",
      }}
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 5], fov: 60, near: 0.1, far: 2000 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
    >
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[bgColor, 10, 40]} />
      <Suspense fallback={null}>
        <ScrollControls pages={pages} damping={0.25} distance={1}>
          {/* No <Scroll> wrapper — we handle Z translation manually.
              <Scroll> auto-translates children on Y axis which we don't want. */}
          <Background />
          <RunTimeline />
        </ScrollControls>
        <MapControls
          enableRotate={false}
          enableZoom={false}
          enablePan={true}
          screenSpacePanning={true}
        />
        <PostProcessing />
      </Suspense>
    </Canvas>
  );
}

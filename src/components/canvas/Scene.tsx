"use client";

import { Canvas } from "@react-three/fiber";
import { ScrollControls, Scroll } from "@react-three/drei";
import { Suspense } from "react";
import { RunTimeline } from "./RunTimeline";
import { PostProcessing } from "./PostProcessing";
import { Background } from "./Background";
import { useTheme } from "@/components/providers/ThemeProvider";

interface SceneProps {
  activityCount: number;
}

export function Scene({ activityCount }: SceneProps) {
  const pages = Math.max(activityCount, 1) + 1;
  const { theme } = useTheme();
  const bgColor = theme === "dark" ? "#050505" : "#f5f5f5";

  return (
    <Canvas
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 10], fov: 50, near: 0.1, far: 1000 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
    >
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[bgColor, 30, 120]} />
      <Suspense fallback={null}>
        <ScrollControls pages={pages} damping={0.15} distance={1}>
          <Scroll>
            <Background />
            <RunTimeline />
          </Scroll>
        </ScrollControls>
        <PostProcessing />
      </Suspense>
    </Canvas>
  );
}

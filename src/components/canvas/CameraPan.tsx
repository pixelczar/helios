"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useActivityStore } from "@/stores/activityStore";
import { useIsMobile } from "@/hooks/useMediaQuery";

// --- Physics tuning ---
const PAN_SPEED = 0.004; // pointer px → world units
const FRICTION = 0.93; // velocity decay per frame
const PAN_BOUNDS = 3.5; // max world-unit offset from center
const BOUNDS_K = 0.12; // rubber-band spring stiffness
const RETURN_K = 0.07; // return-to-center stiffness
const RETURN_DAMP = 0.80; // return-to-center velocity damping
const EPSILON = 0.0001; // velocity cutoff
const DRAG_THRESH = 3; // px before considered a drag
const MOBILE_Y_BIAS = -1.6; // world units — shifts scene upward on mobile (negative = camera down = content up)
const MOBILE_CAMERA_Z = 9; // slightly pulled back on mobile for full route visibility

// Shared flag so RunCard can skip onClick after a drag
let _wasDrag = false;
export function wasPanDrag() {
  return _wasDrag;
}

export function CameraPan() {
  const { camera, gl, events } = useThree();
  const currentIndex = useActivityStore((s) => s.currentIndex);
  const isMobile = useIsMobile();

  const ref = useRef({
    // Camera offset from origin
    x: 0,
    y: 0,
    // Velocity (computed per-frame from position delta)
    vx: 0,
    vy: 0,
    // Snapshot for velocity computation
    lastX: 0,
    lastY: 0,
    // Pointer state
    down: false,
    dragging: false,
    startPx: 0,
    startPy: 0,
    prevPx: 0,
    prevPy: 0,
    // Activity tracking
    prevIndex: -1,
    returning: false,
  });

  useEffect(() => {
    const el = (events.connected ||
      gl.domElement.parentElement ||
      gl.domElement) as HTMLElement;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const s = ref.current;
      s.down = true;
      s.dragging = false;
      s.startPx = s.prevPx = e.clientX;
      s.startPy = s.prevPy = e.clientY;
      s.returning = false;
      // Snapshot position for velocity tracking
      s.lastX = s.x;
      s.lastY = s.y;
      _wasDrag = false;
    };

    const onMove = (e: PointerEvent) => {
      const s = ref.current;
      if (!s.down) return;

      if (!s.dragging) {
        const dist =
          Math.abs(e.clientX - s.startPx) + Math.abs(e.clientY - s.startPy);
        if (dist < DRAG_THRESH) return;
        s.dragging = true;
        _wasDrag = true;
        document.body.style.cursor = "grabbing";
      }

      const dx = e.clientX - s.prevPx;
      const dy = e.clientY - s.prevPy;
      s.prevPx = e.clientX;
      s.prevPy = e.clientY;

      s.x -= dx * PAN_SPEED;
      s.y += dy * PAN_SPEED;
    };

    const onUp = () => {
      const s = ref.current;
      s.down = false;
      if (s.dragging) {
        document.body.style.cursor = "";
        setTimeout(() => {
          _wasDrag = false;
        }, 80);
      }
      s.dragging = false;
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, events]);

  useFrame(() => {
    const s = ref.current;

    // Spring back to center when the activity changes
    if (s.prevIndex !== -1 && s.prevIndex !== currentIndex) {
      s.returning = true;
    }
    s.prevIndex = currentIndex;

    if (s.down) {
      // While dragging, derive velocity from position change this frame
      s.vx = s.x - s.lastX;
      s.vy = s.y - s.lastY;
      s.lastX = s.x;
      s.lastY = s.y;
    } else {
      // --- Free phase: inertia / springs ---
      if (s.returning) {
        // Spring toward center
        s.vx += -s.x * RETURN_K;
        s.vy += -s.y * RETURN_K;
        s.vx *= RETURN_DAMP;
        s.vy *= RETURN_DAMP;
      } else {
        // Friction
        s.vx *= FRICTION;
        s.vy *= FRICTION;
        // Rubber-band when past bounds
        if (s.x > PAN_BOUNDS) s.vx -= (s.x - PAN_BOUNDS) * BOUNDS_K;
        else if (s.x < -PAN_BOUNDS) s.vx -= (s.x + PAN_BOUNDS) * BOUNDS_K;
        if (s.y > PAN_BOUNDS) s.vy -= (s.y - PAN_BOUNDS) * BOUNDS_K;
        else if (s.y < -PAN_BOUNDS) s.vy -= (s.y + PAN_BOUNDS) * BOUNDS_K;
      }

      s.x += s.vx;
      s.y += s.vy;

      if (Math.abs(s.vx) < EPSILON) s.vx = 0;
      if (Math.abs(s.vy) < EPSILON) s.vy = 0;

      // Return complete
      if (
        s.returning &&
        Math.abs(s.x) < 0.01 &&
        Math.abs(s.y) < 0.01 &&
        s.vx === 0 &&
        s.vy === 0
      ) {
        s.x = s.y = 0;
        s.returning = false;
      }
    }

    camera.position.x = s.x;
    camera.position.y = s.y + (isMobile ? MOBILE_Y_BIAS : 0);
    camera.position.z = isMobile ? MOBILE_CAMERA_Z : 5;
  });

  return null;
}

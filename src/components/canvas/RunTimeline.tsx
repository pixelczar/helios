"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RunCard } from "./RunCard";
import { useActivityStore } from "@/stores/activityStore";
import { useGoalStore, calculateYearlyPaceAtDate } from "@/stores/goalStore";
import { isSnapLocked } from "@/lib/scrollLock";

const RUN_SPACING = 20;

export function RunTimeline() {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null!);
  const activities = useActivityStore((s) => s.activities);
  const currentIndex = useActivityStore((s) => s.currentIndex);
  const setScrollState = useActivityStore((s) => s.setScrollState);
  const yearlyTarget = useGoalStore((s) => s.yearlyTarget);

  // Compute pace ratio for each activity (matches scroll indicator colors)
  const paceRatios = useMemo(
    () =>
      activities.map((a) => {
        const date = new Date(a.start_date_local);
        const { ratio } = calculateYearlyPaceAtDate(activities, yearlyTarget, date);
        return ratio;
      }),
    [activities, yearlyTarget]
  );

  // N activities + 1 Today slot at the end = N+1 items, N gaps between them
  const totalSlots = activities.length;

  // Track whether a programmatic snap is in progress so we don't re-trigger
  const snapping = useRef(false);

  const scrollToIndex = useCallback(
    (index: number) => {
      if (totalSlots <= 0) return;
      snapping.current = true;
      // index 0..N-1 = activities, index N = Today (at offset 1)
      const target = index / totalSlots;
      const scrollable = scroll.el.scrollHeight - scroll.el.clientHeight;
      scroll.el.scrollTo({ top: target * scrollable, behavior: "smooth" });
    },
    [totalSlots, scroll]
  );

  // Light scroll snapping — after the user stops scrolling, gently settle
  // onto the nearest item.
  useEffect(() => {
    const el = scroll.el;
    if (!el || totalSlots <= 0) return;

    let debounceId: number = 0;
    let snapClearId: number = 0;

    const handleScroll = () => {
      if (snapping.current || isSnapLocked()) return;
      clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable <= 0) return;

        const offset = el.scrollTop / scrollable;
        // rawIdx: 0 = oldest, N-1 = newest, N = Today
        const rawIdx = offset * totalSlots;
        const floor = Math.floor(rawIdx);
        const frac = rawIdx - floor;
        // Snap at 20% — very easy to advance to next item
        const nearestIndex = frac >= 0.2
          ? Math.min(floor + 1, totalSlots)
          : Math.max(floor, 0);
        const snapTarget = nearestIndex / totalSlots;
        const distToSnap = Math.abs(offset - snapTarget);

        // Only snap if we're not already sitting on the target
        if (distToSnap > 0.003) {
          snapping.current = true;
          el.scrollTo({ top: snapTarget * scrollable, behavior: "smooth" });
          clearTimeout(snapClearId);
          snapClearId = window.setTimeout(() => { snapping.current = false; }, 800);
        }
      }, 120);
    };

    const handleScrollEnd = () => {
      clearTimeout(snapClearId);
      snapping.current = false;
    };

    const handleUserInput = () => {
      if (snapping.current) {
        snapping.current = false;
        clearTimeout(snapClearId);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    el.addEventListener("scrollend", handleScrollEnd);
    el.addEventListener("wheel", handleUserInput, { passive: true });
    el.addEventListener("touchstart", handleUserInput, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("scrollend", handleScrollEnd);
      el.removeEventListener("wheel", handleUserInput);
      el.removeEventListener("touchstart", handleUserInput);
      clearTimeout(debounceId);
      clearTimeout(snapClearId);
    };
  }, [scroll.el, totalSlots, activities.length]);

  // Spring state for Z-axis
  const zSpring = useRef({ value: 0, velocity: 0, initialized: false });

  useFrame((_, delta) => {
    if (!groupRef.current || activities.length === 0) return;

    const totalDepth = totalSlots * RUN_SPACING;
    const targetZ = scroll.offset * totalDepth;
    const sp = zSpring.current;

    if (!sp.initialized) {
      sp.value = targetZ;
      sp.initialized = true;
    }

    const dt = Math.min(delta, 0.04);
    const stiffness = 120;
    const damping = 20;
    const force = stiffness * (targetZ - sp.value) - damping * sp.velocity;
    sp.velocity += force * dt;
    sp.value += sp.velocity * dt;

    groupRef.current.position.z = sp.value;

    // rawIndex: 0 = oldest, N-1 = newest, N = Today
    const rawIndex = scroll.offset * totalSlots;
    const index = Math.min(activities.length, Math.round(rawIndex));
    const progress = rawIndex - Math.floor(rawIndex);
    setScrollState(index, progress);
  });

  return (
    <group ref={groupRef}>
      {activities.map((activity, index) => (
        <RunCard
          key={activity.id}
          activity={activity}
          index={index}
          zPosition={-index * RUN_SPACING}
          totalRuns={activities.length}
          totalSlots={totalSlots}
          paceRatio={paceRatios[index]}
          prevPaceRatio={index > 0 ? paceRatios[index - 1] : paceRatios[index]}
          isFocused={index === currentIndex}
          onSelect={() => scrollToIndex(index)}
        />
      ))}
    </group>
  );
}

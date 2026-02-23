"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RunCard } from "./RunCard";
import { useActivityStore } from "@/stores/activityStore";
import { useGoalStore, calculateYearlyPaceAtDate } from "@/stores/goalStore";

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

  // Track whether a programmatic snap is in progress so we don't re-trigger
  const snapping = useRef(false);

  const scrollToIndex = useCallback(
    (index: number) => {
      if (activities.length <= 1) return;
      snapping.current = true;
      const target = index / (activities.length - 1);
      const scrollable = scroll.el.scrollHeight - scroll.el.clientHeight;
      scroll.el.scrollTo({ top: target * scrollable, behavior: "smooth" });
    },
    [activities.length, scroll]
  );

  // Light scroll snapping — after the user stops scrolling, gently settle
  // onto the nearest item. Uses a debounce so it only kicks in once momentum
  // has died, and `behavior: "smooth"` keeps the landing buttery.
  useEffect(() => {
    const el = scroll.el;
    if (!el || activities.length <= 1) return;

    let debounceId: number = 0;
    let snapClearId: number = 0;

    const handleScroll = () => {
      if (snapping.current) return;
      clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable <= 0) return;

        const offset = el.scrollTop / scrollable;
        const rawIdx = offset * (activities.length - 1);
        const floor = Math.floor(rawIdx);
        const frac = rawIdx - floor;
        // Snap at 20% instead of 50% — very easy to advance to next item
        const nearestIndex = frac >= 0.2 ? Math.min(floor + 1, activities.length - 1) : floor;
        const snapTarget = nearestIndex / (activities.length - 1);
        const distToSnap = Math.abs(offset - snapTarget);

        // Only snap if we're not already sitting on the target
        if (distToSnap > 0.003) {
          snapping.current = true;
          el.scrollTo({ top: snapTarget * scrollable, behavior: "smooth" });
          // Safety fallback — clear the flag even if scrollend doesn't fire
          clearTimeout(snapClearId);
          snapClearId = window.setTimeout(() => { snapping.current = false; }, 800);
        }
      }, 120);
    };

    // Clear snap lock when the smooth-scroll animation finishes
    const handleScrollEnd = () => {
      clearTimeout(snapClearId);
      snapping.current = false;
    };

    // Cancel snap immediately if the user scrolls again
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
  }, [scroll.el, activities.length]);

  // Spring state for Z-axis (gives scroll transitions a subtle bounce/settle)
  const zSpring = useRef({ value: 0, velocity: 0, initialized: false });

  useFrame((_, delta) => {
    if (!groupRef.current || activities.length === 0) return;

    const totalDepth = (activities.length - 1) * RUN_SPACING;
    const targetZ = scroll.offset * totalDepth;
    const sp = zSpring.current;

    // First frame: snap to target so there's no initial flyover
    if (!sp.initialized) {
      sp.value = targetZ;
      sp.initialized = true;
    }

    // Damped spring: stiff enough to track fast scrolling, underdamped
    // enough to bounce subtly when snapping between activities
    const dt = Math.min(delta, 0.04);
    const stiffness = 300;
    const damping = 26;
    const force = stiffness * (targetZ - sp.value) - damping * sp.velocity;
    sp.velocity += force * dt;
    sp.value += sp.velocity * dt;

    groupRef.current.position.z = sp.value;

    // Use raw offset (not spring) for index/progress so HUD stays responsive
    const rawIndex = scroll.offset * (activities.length - 1);
    const index = Math.round(rawIndex);
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
          paceRatio={paceRatios[index]}
          prevPaceRatio={index > 0 ? paceRatios[index - 1] : paceRatios[index]}
          isFocused={index === currentIndex}
          onSelect={() => scrollToIndex(index)}
        />
      ))}
    </group>
  );
}

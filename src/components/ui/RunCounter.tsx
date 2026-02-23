"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useScrollIndex } from "@/hooks/useScrollIndex";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  useGoalStore,
  calculateGoalProgress,
  type GoalType,
} from "@/stores/goalStore";
import { useActivityStore } from "@/stores/activityStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { TimeRange } from "@/components/ui/SettingsPanel";
import { lockSnap } from "@/lib/scrollLock";

const TIME_RANGE_OPTIONS = [
  { value: "year", label: "This year" },
  { value: "all", label: "Last 200" },
] as const;

const GOAL_TYPE_LABELS: Record<GoalType, { label: string; unit: string }> = {
  weekly_distance: { label: "Weekly distance", unit: "mi" },
  monthly_distance: { label: "Monthly distance", unit: "mi" },
  weekly_runs: { label: "Weekly runs", unit: "runs" },
  monthly_runs: { label: "Monthly runs", unit: "runs" },
};

const EASE_OUT = [0.25, 0.1, 0.25, 1] as const;

// Gentle spring — smooth with a subtle bounce at the end
const SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;
const SPRING_SOFT = { type: "spring", stiffness: 300, damping: 26 } as const;
const SPRING_PILL = { type: "spring", stiffness: 260, damping: 26, mass: 0.9 } as const;

const pillItemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...SPRING_SOFT, opacity: { duration: 0.2 } },
  },
};

const chevronVariants = {
  initial: (direction: -1 | 1) => ({
    opacity: 0,
    x: direction * -4,
    width: 0,
  }),
  animate: {
    opacity: 1,
    x: 0,
    width: 36,
    transition: { ...SPRING, opacity: { duration: 0.2 } },
  },
  exit: (direction: -1 | 1) => ({
    opacity: 0,
    x: direction * -4,
    width: 0,
    transition: { duration: 0.18, ease: EASE_OUT },
  }),
};

export function RunCounter({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const { currentIndex, totalRuns, currentActivity } = useScrollIndex();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);
  const hovering = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const prevIndexRef = useRef(currentIndex);
  const slideDirection = useRef<1 | -1>(1);
  const goals = useGoalStore((s) => s.goals);
  const activities = useActivityStore((s) => s.activities);
  const hiddenGoalIds = useSettingsStore((s) => s.hiddenGoalIds);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!hovering.current && !isMobile) {
      hideTimer.current = setTimeout(() => setVisible(false), 3500);
    }
  }, [isMobile]);

  // Track scroll direction for number slide animation
  useEffect(() => {
    if (currentIndex !== prevIndexRef.current) {
      // displayed = currentIndex + 1 (1 = newest, N = oldest)
      // when currentIndex increases (scrolling older), displayed number increases → slide up
      slideDirection.current = currentIndex > prevIndexRef.current ? 1 : -1;
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  // Show on scroll, auto-hide after 2s of no change
  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [currentIndex, resetHideTimer]);

  // Show on any mouse movement (throttled to avoid excessive state updates)
  useEffect(() => {
    let lastFire = 0;
    const onMove = () => {
      const now = Date.now();
      if (now - lastFire < 300) return;
      lastFire = now;
      resetHideTimer();
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [resetHideTimer]);

  // Keep visible while popover is open
  useEffect(() => {
    if (expanded) {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    }
  }, [expanded]);

  // Programmatic scroll to a specific activity index (activities.length = Today)
  const scrollToIndex = useCallback(
    (index: number) => {
      if (activities.length === 0) return;
      const clamped = Math.max(0, Math.min(index, activities.length));
      // Find the scroll container (same approach as ScrollIndicator)
      const candidates = document.querySelectorAll("div");
      let container: HTMLElement | null = null;
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (
          (style.overflow === "auto" || style.overflow === "scroll" ||
           style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 100
        ) {
          container = el;
          break;
        }
      }
      if (!container) return;
      lockSnap();
      // offset = index / N where N = activities.length (Today at N/N = 1)
      const target = clamped / activities.length;
      const scrollable = container.scrollHeight - container.clientHeight;
      container.scrollTo({ top: target * scrollable, behavior: "smooth" });
    },
    [activities.length]
  );

  const shouldShow = visible || expanded || isMobile;
  const isAtToday = currentIndex >= totalRuns;
  const hasPrev = currentIndex > 0; // can go newer (lower index)
  const hasNext = currentIndex < totalRuns; // can go older / toward Today (higher index)

  const asOfDate = useMemo(() => {
    if (currentActivity) return new Date(currentActivity.start_date_local);
    return new Date();
  }, [currentActivity]);

  const visibleGoals = useMemo(
    () => goals.filter((g) => !hiddenGoalIds.includes(g.id)),
    [goals, hiddenGoalIds]
  );

  const progresses = useMemo(
    () => visibleGoals.map((g) => calculateGoalProgress(g, activities, asOfDate)),
    [visibleGoals, activities, asOfDate]
  );

  if (totalRuns === 0) return null;

  return (
    <motion.div
      className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto z-20 gap-4"
      initial="visible"
      animate={shouldShow ? "visible" : "hidden"}
      variants={{
        hidden: {
          opacity: 0, y: 14, scale: 0.95, filter: "blur(6px)", pointerEvents: "none" as const,
          transition: reducedMotion ? { duration: 0 } : { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
        },
        visible: {
          opacity: 1, y: 0, scale: 1, filter: "blur(0px)", pointerEvents: "auto" as const,
          transition: reducedMotion ? { duration: 0 } : { ...SPRING_SOFT, opacity: { duration: 0.3 }, filter: { duration: 0.3 } },
        },
      }}
      onHoverStart={() => { hovering.current = true; setVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current); }}
      onHoverEnd={() => { hovering.current = false; if (!expanded && !isMobile) hideTimer.current = setTimeout(() => setVisible(false), 2500); }}
    >
      {/* Pill — layout animates width as chevrons mount/unmount */}
      <motion.div
        layout
        transition={{ layout: reducedMotion ? { duration: 0 } : SPRING_PILL }}
        className="bg-neutral-900/20 backdrop-blur-md rounded-full flex items-center shadow-2xl shadow-black/40 select-none transition-colors duration-500 hover:bg-neutral-900/80 overflow-hidden"
      >
        {/* Prev chevron — only when not at oldest */}
        <AnimatePresence initial={false}>
          {hasPrev && (
            <motion.button
              key="prev"
              custom={-1}
              variants={chevronVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              whileTap={{ scale: 0.8, transition: { type: "spring", stiffness: 500, damping: 20 } }}
              onClick={(e) => { e.stopPropagation(); scrollToIndex(currentIndex - 1); }}
              className="group/chevron flex-none flex items-center justify-center h-9 rounded-full cursor-pointer overflow-hidden hover:bg-white/10 transition-colors duration-200"
              aria-label="Previous run"
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-neutral-500 transition-colors duration-300 group-hover/chevron:text-neutral-200 flex-none"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Center — clickable to expand settings */}
        <motion.button
          layout
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-6 px-3 py-2 cursor-pointer"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.04 } },
          }}
        >
          {/* Goal rings */}
          {progresses.map((p) => (
            <motion.div key={p.goal.id} variants={pillItemVariants} layout>
              <GoalRing progress={p} />
            </motion.div>
          ))}

          {/* Run counter — hidden when at Today */}
          {!isAtToday && (
            <motion.div
              layout
              className="flex items-baseline gap-2 font-sans tabular-nums"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.04 } },
              }}
            >
              <motion.div
                variants={pillItemVariants}
                layout
                className="relative overflow-hidden"
                style={{ height: "1.5rem" }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={currentIndex}
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: slideDirection.current * 18 }}
                    animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: slideDirection.current * -18 }}
                    transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 28, opacity: { duration: 0.15 } }}
                    className="text-base text-neutral-200 block"
                  >
                    {currentIndex + 1}
                  </motion.span>
                </AnimatePresence>
              </motion.div>
              <motion.span
                className="text-base text-neutral-500 font-bold flex items-baseline gap-2"
                variants={pillItemVariants}
                layout
              >
                <span className="text-sm font-light opacity-50">/</span>
                <span className="font-light">{totalRuns}</span>
              </motion.span>
            </motion.div>
          )}
        </motion.button>

        {/* Next chevron — only when not at newest */}
        <AnimatePresence initial={false}>
          {hasNext && (
            <motion.button
              key="next"
              custom={1}
              variants={chevronVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              whileTap={{ scale: 0.8, transition: { type: "spring", stiffness: 500, damping: 20 } }}
              onClick={(e) => { e.stopPropagation(); scrollToIndex(currentIndex + 1); }}
              className="group/chevron flex-none flex items-center justify-center h-9 rounded-full cursor-pointer overflow-hidden hover:bg-white/10 transition-colors duration-200"
              aria-label="Next run"
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-neutral-500 transition-colors duration-300 group-hover/chevron:text-neutral-200 flex-none"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Popover with scrim — portaled to body so backdrop-filter works */}
      {createPortal(
        <AnimatePresence>
          {expanded && (
            <>
              {/* Blur scrim */}
              <motion.div
                className="fixed inset-0 z-40"
                initial={{ backgroundColor: "rgba(0,0,0,0)", backdropFilter: "blur(0px)" }}
                animate={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}
                exit={{ backgroundColor: "rgba(0,0,0,0)", backdropFilter: "blur(0px)" }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                onClick={() => setExpanded(false)}
              />
              {/* Panel */}
              <motion.div
                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="bg-neutral-950/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                  <SettingsContent
                    timeRange={timeRange}
                    onTimeRangeChange={onTimeRangeChange}
                  />
                </div>
                {/* Close button */}
                <button
                  onClick={() => setExpanded(false)}
                  className="mt-3 mx-auto flex items-center justify-center w-10 h-10 rounded-full bg-neutral-900/20 backdrop-blur-lg shadow-2xl shadow-black/40 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900/80 transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}

function GoalRing({
  progress,
}: {
  progress: ReturnType<typeof calculateGoalProgress>;
}) {
  const { goal, current, percentage } = progress;
  const reducedMotion = useReducedMotion();
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const gradientId = `goalGrad-${goal.id}`;

  const displayValue = goal.type.endsWith("distance")
    ? current.toFixed(1)
    : String(Math.round(current));

  return (
    <div className="relative w-8 h-8 -ml-2">
      <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
        <circle
          cx="16" cy="16" r={radius}
          fill="none" stroke="currentColor" strokeWidth="1.5"
          className="text-neutral-800"
        />
        <motion.circle
          cx="16" cy="16" r={radius}
          fill="none" stroke={`url(#${gradientId})`}
          strokeWidth="1.5" strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", damping: 20, stiffness: 100 }}
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff8844" />
            <stop offset="100%" stopColor="#00ffcc" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={displayValue}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : 0.12 }}
            className="text-[9px] font-medium text-neutral-300 tabular-nums"
          >
            {displayValue}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}

function SettingsContent({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const goals = useGoalStore((s) => s.goals);
  const yearlyTarget = useGoalStore((s) => s.yearlyTarget);
  const setYearlyTarget = useGoalStore((s) => s.setYearlyTarget);
  const updateGoal = useGoalStore((s) => s.updateGoal);
  const removeGoal = useGoalStore((s) => s.removeGoal);
  const addGoal = useGoalStore((s) => s.addGoal);
  const showMapOverlay = useSettingsStore((s) => s.showMapOverlay);
  const setShowMapOverlay = useSettingsStore((s) => s.setShowMapOverlay);
  const hiddenGoalIds = useSettingsStore((s) => s.hiddenGoalIds);
  const toggleGoalVisibility = useSettingsStore((s) => s.toggleGoalVisibility);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setIsDemo(document.cookie.includes("demo_mode=true"));
  }, []);

  return (
    <div className="px-4 pb-4 pt-4 w-[280px] space-y-4">

      {/* Time range */}
      <Section title="Showing">
        <ToggleRow
          options={TIME_RANGE_OPTIONS.map((o) => o.label)}
          selected={TIME_RANGE_OPTIONS.findIndex((o) => o.value === timeRange)}
          onSelect={(i) => onTimeRangeChange(TIME_RANGE_OPTIONS[i].value)}
        />
      </Section>

      {/* Map overlay */}
      <Section title="Map">
        <ToggleRow
          options={["Hide", "Show"]}
          selected={showMapOverlay ? 1 : 0}
          onSelect={(i) => setShowMapOverlay(i === 1)}
        />
      </Section>

      {/* Theme */}
      <Section title="Theme">
        <ToggleRow
          options={["Dark", "Light"]}
          selected={theme === "dark" ? 0 : 1}
          onSelect={(i) => {
            if ((i === 0 && theme !== "dark") || (i === 1 && theme !== "light"))
              toggleTheme();
          }}
        />
      </Section>

      {/* Yearly goal */}
      <Section title="Yearly target">
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={yearlyTarget}
            onChange={(e) =>
              setYearlyTarget(Math.max(1, Number(e.target.value)))
            }
            className="w-20 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-neutral-200 tabular-nums outline-none focus:border-white/15 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs text-neutral-500">mi / year</span>
        </div>
      </Section>

      {/* Goals with visibility toggles */}
      <Section title="Goals">
        <div className="space-y-2">
          {goals.map((goal) => {
            const info = GOAL_TYPE_LABELS[goal.type];
            const visible = !hiddenGoalIds.includes(goal.id);
            return (
              <div key={goal.id} className="flex items-center gap-2 group">
                {/* Visibility toggle */}
                <button
                  onClick={() => toggleGoalVisibility(goal.id)}
                  className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                    visible
                      ? "text-neutral-300"
                      : "text-neutral-700"
                  }`}
                  title={visible ? "Hide gauge" : "Show gauge"}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    {visible ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    )}
                  </svg>
                </button>
                <span className="text-xs text-neutral-500 flex-1 min-w-0 truncate">
                  {info.label}
                </span>
                <input
                  type="number"
                  value={goal.target}
                  onChange={(e) =>
                    updateGoal(goal.id, Math.max(1, Number(e.target.value)))
                  }
                  className="w-14 bg-white/[0.03] border border-white/[0.06] rounded-md px-2 py-1 text-xs text-neutral-200 tabular-nums text-right outline-none focus:border-white/15 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[11px] text-neutral-600 w-6">
                  {info.unit}
                </span>
                <button
                  onClick={() => removeGoal(goal.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:bg-white/5"
                >
                  <svg
                    width="10" height="10" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2"
                    className="text-neutral-600"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        <AddGoalButton
          onAdd={addGoal}
          existingTypes={goals.map((g) => g.type)}
        />
      </Section>

      {/* Divider */}
      <div className="h-px bg-white/[0.04]" />

      {/* Logout / Exit demo */}
      <a
        href="/api/auth/logout"
        className="flex items-center gap-2 text-xs text-amber-500/70 hover:text-amber-400 transition-colors py-1"
      >
        {isDemo ? "Exit Demo Mode" : "Disconnect Strava"}
        <svg
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </a>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-mono uppercase tracking-widest text-neutral-600 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ToggleRow({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onSelect(i)}
          className={`flex-1 text-xs py-1.5 rounded-md transition-all duration-200 ${
            selected === i
              ? "bg-white/10 text-neutral-200"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function AddGoalButton({
  onAdd,
  existingTypes,
}: {
  onAdd: (type: GoalType, target: number) => void;
  existingTypes: GoalType[];
}) {
  const [showPicker, setShowPicker] = useState(false);
  const available: GoalType[] = (
    [
      "weekly_distance",
      "monthly_distance",
      "weekly_runs",
      "monthly_runs",
    ] as GoalType[]
  ).filter((t) => !existingTypes.includes(t));

  if (available.length === 0) return null;

  return (
    <div className="mt-2">
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          className="text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors flex items-center gap-1"
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add goal
        </button>
      ) : (
        <div className="space-y-0.5">
          {available.map((type) => (
            <button
              key={type}
              onClick={() => {
                const defaultTarget = type.endsWith("distance") ? 20 : 4;
                onAdd(type, defaultTarget);
                setShowPicker(false);
              }}
              className="block w-full text-left text-xs text-neutral-500 hover:text-neutral-200 hover:bg-white/5 rounded-md px-2 py-1.5 transition-colors"
            >
              {GOAL_TYPE_LABELS[type].label}
            </button>
          ))}
          <button
            onClick={() => setShowPicker(false)}
            className="text-[11px] text-neutral-700 mt-1 px-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

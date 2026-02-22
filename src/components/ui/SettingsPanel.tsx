"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useGoalStore, type GoalType } from "@/stores/goalStore";
import { useActivityStore } from "@/stores/activityStore";

const GOAL_TYPE_LABELS: Record<GoalType, { label: string; unit: string }> = {
  weekly_distance: { label: "Weekly distance", unit: "mi" },
  monthly_distance: { label: "Monthly distance", unit: "mi" },
  weekly_runs: { label: "Weekly runs", unit: "runs" },
  monthly_runs: { label: "Monthly runs", unit: "runs" },
};

const TIME_RANGE_OPTIONS = [
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
] as const;

export type TimeRange = (typeof TIME_RANGE_OPTIONS)[number]["value"];

export function SettingsPanel({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Wordmark trigger — sits at top-left, feels native */}
      <button
        onClick={() => setOpen(true)}
        className="absolute top-7 left-12 pointer-events-auto group flex items-center gap-2"
      >
        <span className="text-[11px] font-medium tracking-[0.35em] uppercase text-neutral-600 group-hover:text-neutral-300 transition-colors duration-500">
          Fun Run
        </span>
        <motion.span
          className="text-neutral-700 group-hover:text-neutral-400 transition-colors duration-500"
          animate={{ rotate: open ? 180 : 0 }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 pointer-events-auto"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{
                type: "spring",
                damping: 28,
                stiffness: 350,
              }}
              className="fixed left-8 top-16 w-[300px] bg-neutral-950/95 backdrop-blur-2xl border border-white/[0.06] rounded-2xl z-50 pointer-events-auto overflow-hidden shadow-2xl shadow-black/40"
            >
              <PanelContent
                onClose={() => setOpen(false)}
                timeRange={timeRange}
                onTimeRangeChange={onTimeRangeChange}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function PanelContent({
  onClose,
  timeRange,
  onTimeRangeChange,
}: {
  onClose: () => void;
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
  const totalRuns = useActivityStore((s) => s.activities.length);

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Time range */}
        <Section title="Showing">
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
            {TIME_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onTimeRangeChange(opt.value);
                  onClose();
                }}
                className={`flex-1 text-xs py-1.5 rounded-md transition-all duration-200 ${
                  timeRange === opt.value
                    ? "bg-white/10 text-neutral-200"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-600 mt-2 tabular-nums">
            {totalRuns} runs loaded
          </p>
        </Section>

        {/* Theme */}
        <Section title="Theme">
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={t !== theme ? toggleTheme : undefined}
                className={`flex-1 text-xs py-1.5 rounded-md transition-all duration-200 capitalize ${
                  theme === t
                    ? "bg-white/10 text-neutral-200"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
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

        {/* Goals */}
        <Section title="Goals">
          <div className="space-y-2">
            {goals.map((goal) => {
              const info = GOAL_TYPE_LABELS[goal.type];
              return (
                <div key={goal.id} className="flex items-center gap-2 group">
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
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
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
          {goals.length < 4 && (
            <AddGoalButton
              onAdd={addGoal}
              existingTypes={goals.map((g) => g.type)}
            />
          )}
        </Section>

        {/* Divider */}
        <div className="h-px bg-white/[0.04]" />

        {/* Logout */}
        <a
          href="/api/auth/logout"
          className="flex items-center gap-2 text-xs text-neutral-600 hover:text-neutral-400 transition-colors py-1"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Disconnect Strava
        </a>
      </div>
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
      <h3 className="text-[11px] uppercase tracking-widest text-neutral-600 mb-2.5">
        {title}
      </h3>
      {children}
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
    <div className="mt-3">
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          className="text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors flex items-center gap-1"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add goal
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-0.5"
        >
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
        </motion.div>
      )}
    </div>
  );
}

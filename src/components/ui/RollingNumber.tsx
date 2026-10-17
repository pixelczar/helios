"use client";

import { motion } from "framer-motion";

// Two turns of the wheel so every digit can roll upward into place
const DIGITS = "01234567890123456789".split("");
const EASE = [0.16, 1, 0.3, 1] as const;

interface RollingNumberProps {
  value: string; // preformatted, e.g. "278.3"
  delay?: number;
  reducedMotion?: boolean | null;
}

/**
 * Odometer-style number: each digit is a column of 0–9 that rolls into
 * place, rightmost first, so the value settles like a mechanical counter.
 * Non-digits (".", ":") sit still. Relies on tabular numerals so every
 * column is the same width. Remount (key) to roll again.
 */
export function RollingNumber({ value, delay = 0, reducedMotion }: RollingNumberProps) {
  const chars = value.split("");
  const digitCount = chars.filter((c) => c >= "0" && c <= "9").length;
  let digitIndex = 0;

  return (
    <span className="relative inline-flex tabular-nums">
      {/* Real value for screen readers and copy; the wheels are decorative */}
      <span className="sr-only">{value}</span>
      {chars.map((char, i) => {
        if (char < "0" || char > "9") {
          return (
            <span key={i} aria-hidden="true" className="select-none">
              {char}
            </span>
          );
        }
        const d = Number(char);
        // Rightmost digits move first and travel furthest (a full turn),
        // like the fast wheels of a real counter; higher places turn less
        const fromRight = digitCount - 1 - digitIndex++;
        const endRow = d + 10;
        const startRow = endRow - Math.max(3, 10 - fromRight * 2);
        return (
          <span
            key={i}
            aria-hidden="true"
            className="relative inline-block select-none"
            style={{ height: "1em", lineHeight: 1, overflowY: "clip", overflowX: "visible", overflowClipMargin: "0.12em" }}
          >
            <motion.span
              className="flex flex-col"
              initial={{ y: `${-(reducedMotion ? endRow : startRow)}em` }}
              animate={{ y: `${-endRow}em` }}
              transition={{
                duration: reducedMotion ? 0 : Math.max(0.6, 1.0 - fromRight * 0.08),
                delay: reducedMotion ? 0 : delay + fromRight * 0.05,
                ease: EASE,
              }}
            >
              {DIGITS.map((n, row) => (
                <span key={row} style={{ height: "1em", lineHeight: 1 }}>
                  {n}
                </span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

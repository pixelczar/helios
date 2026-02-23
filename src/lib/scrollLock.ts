/**
 * Simple module-level scroll lock to prevent RunTimeline's snap logic
 * from interfering with programmatic smooth scrolls (e.g. "Today" button).
 */
let lockedUntil = 0;

export function lockSnap(ms = 1200) {
  lockedUntil = Date.now() + ms;
}

export function isSnapLocked() {
  return Date.now() < lockedUntil;
}

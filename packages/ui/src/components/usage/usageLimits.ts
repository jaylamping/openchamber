import type { UsageWindow } from '@/types';
import type { UsageLimitRow, UsageProviderGroup } from './usageGroups';

export type UsageTone = 'default' | 'warning' | 'error';

/** Same thresholds the work-status rows used, so a limit keeps its colour. */
export const usageTone = (usedPercent: number | null): UsageTone => {
  if (usedPercent === null || !Number.isFinite(usedPercent)) return 'default';
  if (usedPercent >= 80) return 'error';
  if (usedPercent >= 50) return 'warning';
  return 'default';
};

/**
 * The limit that decides whether a provider can keep working: the most used
 * one, and on a tie the shorter window, since it runs out first. Rows with no
 * percentage (credit balances, counters) cannot be compared and never win.
 */
export const pickTightestRow = (group: UsageProviderGroup): UsageLimitRow | null => {
  let best: UsageLimitRow | null = null;
  for (const row of group.rows) {
    const used = row.window.usedPercent;
    if (used === null || !Number.isFinite(used)) continue;
    if (!best) {
      best = row;
      continue;
    }
    const bestUsed = best.window.usedPercent ?? 0;
    const shorter = (row.window.windowSeconds ?? Infinity) < (best.window.windowSeconds ?? Infinity);
    if (used > bestUsed || (used === bestUsed && shorter)) best = row;
  }
  return best;
};

/**
 * Time until a limit resets, as two units at most (`4h24m`, `5d4h`, `42m`):
 * short enough for a header that stays on screen all day.
 */
export const formatUsageCountdown = (
  window: Pick<UsageWindow, 'resetAt' | 'resetAfterSeconds'>,
  now: number,
): string | null => {
  const seconds = window.resetAt !== null
    ? (window.resetAt - now) / 1000
    : window.resetAfterSeconds;
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d${hours % 24}h`;
  if (hours > 0) return `${hours}h${minutes % 60}m`;
  return `${Math.max(1, minutes)}m`;
};

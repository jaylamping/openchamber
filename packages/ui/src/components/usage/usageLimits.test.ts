import { describe, expect, test } from 'bun:test';
import type { UsageWindow } from '@/types';
import type { UsageProviderGroup } from './usageGroups';
import { formatUsageCountdown, pickTightestRow, usageTone } from './usageLimits';

const usageWindow = (usedPercent: number | null, windowSeconds: number | null = null): UsageWindow => ({
  usedPercent,
  remainingPercent: usedPercent === null ? null : 100 - usedPercent,
  windowSeconds,
  resetAfterSeconds: null,
  resetAt: null,
  resetAtFormatted: null,
  resetAfterFormatted: null,
});

const group = (rows: UsageProviderGroup['rows']): UsageProviderGroup => ({
  providerId: 'claude',
  providerName: 'Claude',
  rows,
  status: null,
});

describe('tightest limit', () => {
  test('is the most used one', () => {
    const tightest = pickTightestRow(group([
      { key: 'a', label: '5-Hour', window: usageWindow(2, 18_000) },
      { key: 'b', label: '7-Day', window: usageWindow(43, 604_800) },
    ]));
    expect(tightest?.key).toBe('b');
  });

  test('a tie goes to the shorter window, which runs out first', () => {
    const tightest = pickTightestRow(group([
      { key: 'week', label: '7-Day', window: usageWindow(10, 604_800) },
      { key: 'hours', label: '5-Hour', window: usageWindow(10, 18_000) },
    ]));
    expect(tightest?.key).toBe('hours');
  });

  test('rows without a percentage never win, and none at all gives null', () => {
    expect(pickTightestRow(group([
      { key: 'credits', label: 'Credits', window: usageWindow(null) },
      { key: 'month', label: 'Monthly', window: usageWindow(5) },
    ]))?.key).toBe('month');
    expect(pickTightestRow(group([{ key: 'credits', label: 'Credits', window: usageWindow(null) }]))).toBeNull();
  });
});

describe('countdown', () => {
  const now = Date.UTC(2026, 9, 6, 12, 0, 0);

  test('reads like oh-my-pi: two units, largest first', () => {
    expect(formatUsageCountdown({ resetAt: now + (4 * 60 + 24) * 60_000, resetAfterSeconds: null }, now)).toBe('4h24m');
    expect(formatUsageCountdown({ resetAt: now + ((5 * 24 + 4) * 60 + 30) * 60_000, resetAfterSeconds: null }, now)).toBe('5d4h');
    expect(formatUsageCountdown({ resetAt: now + 42 * 60_000, resetAfterSeconds: null }, now)).toBe('42m');
  });

  test('falls back to the seconds the provider reported', () => {
    expect(formatUsageCountdown({ resetAt: null, resetAfterSeconds: 3 * 3600 }, now)).toBe('3h0m');
  });

  test('a reset in the past or unknown says nothing', () => {
    expect(formatUsageCountdown({ resetAt: now - 1000, resetAfterSeconds: null }, now)).toBeNull();
    expect(formatUsageCountdown({ resetAt: null, resetAfterSeconds: null }, now)).toBeNull();
  });
});

describe('tone', () => {
  test('warns from half used and alarms from four-fifths', () => {
    expect(usageTone(10)).toBe('default');
    expect(usageTone(50)).toBe('warning');
    expect(usageTone(80)).toBe('error');
    expect(usageTone(null)).toBe('default');
  });
});

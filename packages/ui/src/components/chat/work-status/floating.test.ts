import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_WORK_STATUS_FLOAT_POSITION,
  WORK_STATUS_FLOAT_MARGIN,
  clampFloatOffset,
  normalizeFloatIdleOpacity,
  placeFloat,
  toFloatPosition,
} from './floating';

const area = { width: 1200, height: 800 };
const card = { width: 300, height: 400 };

describe('floating work-status placement', () => {
  test('the default sits in the top-right corner of the chat area', () => {
    expect(placeFloat(null, area, card)).toEqual({
      left: area.width - card.width - DEFAULT_WORK_STATUS_FLOAT_POSITION.inset,
      top: DEFAULT_WORK_STATUS_FLOAT_POSITION.top,
    });
  });

  test('a card dropped on the right half keeps its distance from the right edge', () => {
    const position = toFloatPosition({ left: 800, top: 120 }, area, card);
    expect(position).toEqual({ side: 'right', inset: 100, top: 120 });
    // The window widens: the card follows the right edge instead of drifting
    // toward the middle.
    expect(placeFloat(position, { width: 1600, height: 800 }, card)).toEqual({ left: 1200, top: 120 });
  });

  test('a card dropped on the left half keeps its distance from the left edge', () => {
    const position = toFloatPosition({ left: 40, top: 300 }, area, card);
    expect(position).toEqual({ side: 'left', inset: 40, top: 300 });
    expect(placeFloat(position, { width: 1600, height: 800 }, card)).toEqual({ left: 40, top: 300 });
  });

  test('a shrinking chat area pulls the card back inside instead of losing it', () => {
    const position = { side: 'left' as const, inset: 1000, top: 700 };
    expect(placeFloat(position, { width: 900, height: 600 }, card)).toEqual({
      left: 900 - card.width - WORK_STATUS_FLOAT_MARGIN,
      top: 600 - card.height - WORK_STATUS_FLOAT_MARGIN,
    });
  });

  test('dragging past an edge stops at the margin', () => {
    expect(clampFloatOffset(-50, -50, area, card)).toEqual({ left: WORK_STATUS_FLOAT_MARGIN, top: WORK_STATUS_FLOAT_MARGIN });
    expect(clampFloatOffset(5000, 5000, area, card)).toEqual({
      left: area.width - card.width - WORK_STATUS_FLOAT_MARGIN,
      top: area.height - card.height - WORK_STATUS_FLOAT_MARGIN,
    });
  });

  test('a card larger than the area pins to the top-left margin', () => {
    expect(clampFloatOffset(200, 200, { width: 200, height: 200 }, card)).toEqual({
      left: WORK_STATUS_FLOAT_MARGIN,
      top: WORK_STATUS_FLOAT_MARGIN,
    });
  });

  test('a corrupt stored position falls back to the default corner', () => {
    expect(placeFloat({ side: 'left', inset: Number.NaN, top: 10 }, area, card)).toEqual(placeFloat(null, area, card));
    expect(placeFloat({ side: 'right', inset: 10, top: Number.POSITIVE_INFINITY }, area, card)).toEqual(placeFloat(null, area, card));
  });
});

describe('idle opacity', () => {
  test('stays within the readable range and snaps to five-percent steps', () => {
    expect(normalizeFloatIdleOpacity(0.62)).toBe(0.6);
    expect(normalizeFloatIdleOpacity(0)).toBe(0.2);
    expect(normalizeFloatIdleOpacity(3)).toBe(1);
  });

  test('a non-number falls back to the default', () => {
    expect(normalizeFloatIdleOpacity(Number.NaN)).toBe(0.6);
  });
});

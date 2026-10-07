/**
 * Where a floating work-status card sits, measured from the side of the chat
 * area it is nearer to. A card parked against the right edge stays against it
 * when the window widens, instead of drifting toward the middle.
 */
export type WorkStatusFloatPosition = {
  side: 'left' | 'right';
  /** Distance from that side of the chat area to the card's edge, in px. */
  inset: number;
  top: number;
};

type Size = { width: number; height: number };

/** The card's top-left corner relative to the chat area, in px. */
export type FloatOffset = { left: number; top: number };

/** Closest the card may get to any edge of the chat area. */
export const WORK_STATUS_FLOAT_MARGIN = 12;

/** Where the docked panel lives: top-right, just inside the chat. */
export const DEFAULT_WORK_STATUS_FLOAT_POSITION: WorkStatusFloatPosition = { side: 'right', inset: 16, top: 16 };

export const WORK_STATUS_FLOAT_OPACITY_MIN = 0.2;
export const DEFAULT_WORK_STATUS_FLOAT_IDLE_OPACITY = 0.6;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Keeps the whole card inside `bounds`; a card too big for them pins top-left. */
export const clampFloatOffset = (left: number, top: number, bounds: Size, card: Size): FloatOffset => ({
  left: clamp(left, WORK_STATUS_FLOAT_MARGIN, bounds.width - card.width - WORK_STATUS_FLOAT_MARGIN),
  top: clamp(top, WORK_STATUS_FLOAT_MARGIN, bounds.height - card.height - WORK_STATUS_FLOAT_MARGIN),
});

export const placeFloat = (position: WorkStatusFloatPosition | null, bounds: Size, card: Size): FloatOffset => {
  const stored = position && Number.isFinite(position.inset) && Number.isFinite(position.top)
    ? position
    : DEFAULT_WORK_STATUS_FLOAT_POSITION;
  const left = stored.side === 'left' ? stored.inset : bounds.width - card.width - stored.inset;
  return clampFloatOffset(left, stored.top, bounds, card);
};

export const toFloatPosition = (offset: FloatOffset, bounds: Size, card: Size): WorkStatusFloatPosition => (
  offset.left + card.width / 2 > bounds.width / 2
    ? { side: 'right', inset: Math.max(0, bounds.width - card.width - offset.left), top: offset.top }
    : { side: 'left', inset: Math.max(0, offset.left), top: offset.top }
);

/** Five-percent steps; below the minimum the card is too faint to find again. */
export const normalizeFloatIdleOpacity = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_WORK_STATUS_FLOAT_IDLE_OPACITY;
  return Math.round(clamp(value, WORK_STATUS_FLOAT_OPACITY_MIN, 1) * 20) / 20;
};

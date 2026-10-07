import React from 'react';
import { useUIStore } from '@/stores/useUIStore';
import { clampFloatOffset, placeFloat, toFloatPosition, type FloatOffset } from './floating';

/** Arrow keys move the card this far; Shift moves it four times as far. */
const KEYBOARD_STEP = 16;

const keyDirection = (key: string): readonly [number, number] | null => {
  switch (key) {
    case 'ArrowLeft': return [-1, 0];
    case 'ArrowRight': return [1, 0];
    case 'ArrowUp': return [0, -1];
    case 'ArrowDown': return [0, 1];
    default: return null;
  }
};

type Geometry = {
  /** The whole chat area, right-side panels included: where the card lives. */
  area: { width: number; height: number };
  /** The part of it the transcript shows: where a drag may drop the card. */
  visible: { width: number; height: number };
  card: { width: number; height: number };
};

type DragState = { pointerId: number; startX: number; startY: number; origin: FloatOffset };

type Result = {
  /** Attach to the absolutely positioned frame around the card. */
  frameRef: (node: HTMLDivElement | null) => void;
  /** Spread onto the drag handle. */
  handleProps: Pick<
    React.HTMLAttributes<HTMLElement>,
    'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture' | 'onKeyDown'
  >;
  dragging: boolean;
};

/**
 * Coordinates are relative to the frame's offset parent: the clipping layer
 * filling the chat's own box,
 * which shares its top-left corner with the chat area. The area is measured
 * separately because it also spans the right-side panels. The card keeps its
 * place underneath them when they open, and the chat's overflow clipping makes
 * them cover it, instead of the card being shoved aside.
 */
const measure = (frame: HTMLElement): Geometry | null => {
  const container = frame.offsetParent;
  if (!container) return null;
  const visible = container.getBoundingClientRect();
  const area = frame.closest('[data-chat-area]')?.getBoundingClientRect() ?? visible;
  return {
    area: { width: area.right - visible.left, height: area.bottom - visible.top },
    visible: { width: visible.width, height: visible.height },
    card: { width: frame.offsetWidth, height: frame.offsetHeight },
  };
};

/**
 * Places the floating work-status card and lets the user drag it.
 *
 * During a drag the frame's transform is written straight to the element:
 * routing every pointer move through React would re-render every section of
 * the panel on each frame. The store hears only where the card was dropped.
 */
export const useWorkStatusFloat = (enabled: boolean): Result => {
  const position = useUIStore((state) => state.workStatusFloatPosition);
  const setPosition = useUIStore((state) => state.setWorkStatusFloatPosition);
  const [frame, setFrame] = React.useState<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef<DragState | null>(null);
  const offsetRef = React.useRef<FloatOffset | null>(null);

  const apply = React.useCallback((node: HTMLElement, offset: FloatOffset) => {
    offsetRef.current = offset;
    node.style.transform = `translate3d(${offset.left}px, ${offset.top}px, 0)`;
  }, []);

  // Layout effect: placed before the first paint, so the card never flashes
  // in the top-left corner on its way to the stored position.
  React.useLayoutEffect(() => {
    if (!frame || !enabled) return undefined;
    const place = () => {
      // A resize mid-drag must not yank the card out from under the pointer.
      if (dragRef.current) return;
      const geometry = measure(frame);
      if (!geometry) return;
      // A card never moved sits in the transcript's top-right corner, so it
      // is not born under a side panel that happens to be open.
      apply(frame, position
        ? placeFloat(position, geometry.area, geometry.card)
        : placeFloat(null, geometry.visible, geometry.card));
    };
    place();
    if (!('ResizeObserver' in window)) return undefined;
    // The card's own size changes as sections fold, and the area's with the
    // window; either can push the card past an edge.
    const observer = new ResizeObserver(place);
    observer.observe(frame);
    const area = frame.closest('[data-chat-area]');
    if (area) observer.observe(area);
    return () => observer.disconnect();
  }, [apply, enabled, frame, position]);

  const commit = React.useCallback(() => {
    if (!frame || !offsetRef.current) return;
    const geometry = measure(frame);
    if (geometry) setPosition(toFloatPosition(offsetRef.current, geometry.area, geometry.card));
  }, [frame, setPosition]);

  const endDrag = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    commit();
  }, [commit]);

  const handleProps: Result['handleProps'] = {
    onPointerDown: (event) => {
      // A second finger or another button joining in would make the card jump.
      if (event.button !== 0 || dragRef.current || !offsetRef.current) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: offsetRef.current };
      setDragging(true);
    },
    onPointerMove: (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !frame) return;
      const geometry = measure(frame);
      if (!geometry) return;
      // Dropped only where the transcript is showing: a card let go under an
      // open side panel would be lost until that panel closed.
      apply(frame, clampFloatOffset(
        drag.origin.left + event.clientX - drag.startX,
        drag.origin.top + event.clientY - drag.startY,
        geometry.visible,
        geometry.card,
      ));
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
    onKeyDown: (event) => {
      const direction = keyDirection(event.key);
      if (!direction || !frame || !offsetRef.current) return;
      event.preventDefault();
      const geometry = measure(frame);
      if (!geometry) return;
      const step = event.shiftKey ? KEYBOARD_STEP * 4 : KEYBOARD_STEP;
      apply(frame, clampFloatOffset(
        offsetRef.current.left + direction[0] * step,
        offsetRef.current.top + direction[1] * step,
        geometry.visible,
        geometry.card,
      ));
      commit();
    },
  };

  return { frameRef: setFrame, handleProps, dragging };
};

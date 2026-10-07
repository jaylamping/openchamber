import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import { useUIStore } from '@/stores/useUIStore';
import { useWorkStatusFloat } from './useWorkStatusFloat';

// happy-dom has no layout, so the boxes the hook measures are stubbed by id: a
// 1000×800 chat area whose transcript is 800 wide, as when a 200px side panel
// is open, and a 300×400 card.
const sizeOf = (id: string) => {
  if (id === 'area') return { width: 1000, height: 800 };
  if (id === 'chat') return { width: 800, height: 800 };
  return { width: 0, height: 0 };
};
const CARD = { width: 300, height: 400 };

const Harness = () => {
  const float = useWorkStatusFloat(true);
  return (
    <div id="area" data-chat-area="true">
      <div id="chat">
        <div id="frame" ref={float.frameRef}>
          <button id="handle" type="button" {...float.handleProps} />
        </div>
      </div>
    </div>
  );
};

describe('floating work-status drag', () => {
  let win: Window;
  let root: Root;
  let restoreGlobals: () => void;

  const frame = () => document.getElementById('frame');
  const handle = () => {
    const node = document.getElementById('handle');
    if (!node) throw new Error('Expected the drag handle');
    return node;
  };
  const pointer = async (type: string, clientX: number, clientY: number, pointerId = 1) => {
    await act(async () => {
      handle().dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, button: 0, clientX, clientY }));
    });
  };
  const press = async (key: string, shiftKey = false) => {
    await act(async () => {
      handle().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, shiftKey }));
    });
  };

  beforeEach(async () => {
    win = new Window({ url: 'http://localhost' });
    const values = {
      window: win, document: win.document, navigator: win.navigator,
      Node: win.Node, Element: win.Element, HTMLElement: win.HTMLElement,
      HTMLIFrameElement: win.HTMLIFrameElement, Event: win.Event,
      PointerEvent: win.PointerEvent, KeyboardEvent: win.KeyboardEvent,
      ResizeObserver: win.ResizeObserver, IS_REACT_ACT_ENVIRONMENT: true,
    };
    const previous = Object.keys(values).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    for (const [name, value] of Object.entries(values)) {
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    restoreGlobals = () => {
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    };

    const proto = win.HTMLElement.prototype;
    Object.defineProperty(proto, 'offsetParent', {
      configurable: true,
      get() { return this.id === 'frame' ? win.document.getElementById('chat') : null; },
    });
    Object.defineProperty(proto, 'offsetWidth', { configurable: true, get() { return this.id === 'frame' ? CARD.width : 0; } });
    Object.defineProperty(proto, 'offsetHeight', { configurable: true, get() { return this.id === 'frame' ? CARD.height : 0; } });
    Object.defineProperty(proto, 'getBoundingClientRect', {
      configurable: true,
      value() {
        const size = sizeOf(this.id);
        return { left: 0, top: 0, x: 0, y: 0, right: size.width, bottom: size.height, ...size };
      },
    });
    Object.defineProperty(proto, 'setPointerCapture', { configurable: true, value: () => undefined });

    useUIStore.setState({ workStatusFloatPosition: null });
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    win.close();
    restoreGlobals();
  });

  test('a card never moved sits in the visible transcript, not under the side panel', () => {
    expect(frame()?.style.transform).toBe('translate3d(484px, 16px, 0)');
  });

  test('dragging moves the card and stores where it was dropped', async () => {
    await pointer('pointerdown', 500, 30);
    await pointer('pointermove', 100, 60);
    expect(frame()?.style.transform).toBe('translate3d(84px, 46px, 0)');
    // Nothing is stored until the drop.
    expect(useUIStore.getState().workStatusFloatPosition).toBeNull();
    await pointer('pointerup', 100, 60);
    expect(useUIStore.getState().workStatusFloatPosition).toEqual({ side: 'left', inset: 84, top: 46 });
  });

  test('a drag stops at the edge of the visible transcript and anchors to the nearer side', async () => {
    await pointer('pointerdown', 500, 30);
    await pointer('pointermove', 5000, 30);
    expect(frame()?.style.transform).toBe('translate3d(488px, 16px, 0)');
    await pointer('pointerup', 5000, 30);
    // Measured from the chat area's right edge, past the side panel.
    expect(useUIStore.getState().workStatusFloatPosition).toEqual({ side: 'right', inset: 212, top: 16 });
  });

  test('another pointer joining mid-drag does not move the card', async () => {
    await pointer('pointerdown', 500, 30);
    await pointer('pointermove', 300, 30, 2);
    expect(frame()?.style.transform).toBe('translate3d(484px, 16px, 0)');
    await pointer('pointerup', 300, 30, 2);
    expect(useUIStore.getState().workStatusFloatPosition).toBeNull();
  });

  test('arrow keys nudge the card and store each step', async () => {
    await press('ArrowDown');
    expect(frame()?.style.transform).toBe('translate3d(484px, 32px, 0)');
    await press('ArrowLeft', true);
    expect(frame()?.style.transform).toBe('translate3d(420px, 32px, 0)');
    expect(useUIStore.getState().workStatusFloatPosition).toEqual({ side: 'right', inset: 280, top: 32 });
  });
});

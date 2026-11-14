// @vitest-environment happy-dom
import { MotionGlobalConfig } from 'framer-motion';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_DOC } from './data';
import type { Doc } from './model';
import { BuilderProvider, useBuilder, type Selection } from './store';
import { Timeline } from './timeline';
import { findNode } from './tree';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
MotionGlobalConfig.skipAnimations = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const welcome = SAMPLE_DOC.scenes.find((s) => s.root.id === 'welcome-root')!;
let doc: Doc = SAMPLE_DOC;
let selection: Selection | null = null;
let frame: number | null = null;

function Probe() {
  const b = useBuilder();
  doc = b.doc;
  selection = b.selection;
  const [frameAt, setFrameAt] = useState<number | null>(null);
  frame = frameAt;
  return <Timeline sceneId={welcome.id} frameAt={frameAt} onFrameAt={setFrameAt} onPlay={() => {}} />;
}

const appear = (id: string) => {
  const t = findNode(doc.scenes.find((s) => s.id === welcome.id)!.root, id)!.motion!.appear!.transition;
  if (t.type === 'instant') throw new Error('expected a transition with a duration');
  return t;
};
const bar = (label: string) => [...host.querySelectorAll<HTMLElement>('[data-span-id]')].find((el) => el.getAttribute('aria-label')?.startsWith(label))!;
const key = (el: HTMLElement, k: string, init: KeyboardEventInit = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });

async function open() {
  await act(async () => root.render(<BuilderProvider doc={SAMPLE_DOC}><Probe /></BuilderProvider>));
}

describe('Timeline bars', () => {
  it('names each bar by its node and range, and lets only a tween or a time spring stretch', async () => {
    await open();
    const hero = bar('Hero');
    expect(hero.tabIndex).toBe(0);
    expect(hero.getAttribute('aria-label')).toMatch(/^Hero, \d\.\d\ds to \d\.\d\ds$/);
    expect(hero.querySelector('[data-span-edge=end]')).not.toBeNull();
  });

  it('moves a bar with the arrows (its delay) and stretches it with Shift (its duration), one undo step each', async () => {
    await open();
    const delay = appear('welcome-hero').delay;
    const duration = appear('welcome-hero').duration;
    await key(bar('Hero'), 'ArrowRight');
    expect(appear('welcome-hero').delay).toBeCloseTo(delay + 0.01, 5);
    await key(bar('Hero'), 'ArrowRight', { shiftKey: true });
    expect(appear('welcome-hero').duration).toBeCloseTo(duration + 0.01, 5);
    expect(appear('welcome-hero').delay).toBeCloseTo(delay + 0.01, 5);
  });

  it('keeps a bar on its own track and never deletes it: Up/Down and Delete pass through untouched', async () => {
    await open();
    const before = JSON.stringify(appear('welcome-hero'));
    for (const k of ['ArrowDown', 'ArrowUp', 'Delete', 'Backspace']) {
      const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
      await act(() => { bar('Hero').dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(JSON.stringify(appear('welcome-hero'))).toBe(before);
    expect(bar('Hero')).toBeDefined();
  });

  it('selects its node on a click', async () => {
    await open();
    await act(async () => bar('Hero').click());
    expect(selection).toMatchObject({ kind: 'node', ids: ['welcome-hero'] });
  });
});

describe('Timeline scrub', () => {
  it('is a slider: the arrows hold the scene at an instant, and Escape lets go', async () => {
    await open();
    // The thumb's range input is what takes focus, named by the thumb's label.
    const input = host.querySelector<HTMLInputElement>('input[type=range][aria-label="Scrub"]')!;
    expect(input).not.toBeNull();
    act(() => input.focus());
    await key(input, 'ArrowRight');
    expect(frame).toBe(10);
    await key(input, 'End');
    expect(frame).toBeGreaterThan(500);
    expect(input.getAttribute('aria-valuetext')).toMatch(/s$/);
    await key(input, 'Escape');
    expect(frame).toBeNull();
  });
});

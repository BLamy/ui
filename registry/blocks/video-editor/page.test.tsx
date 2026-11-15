// @vitest-environment happy-dom
import { MotionGlobalConfig } from 'framer-motion';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VideoEditor from './page';

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

const editor = () => host.querySelector<HTMLElement>('[data-slot="video-editor"]')!;
const button = (name: string) => host.querySelector<HTMLElement>(`button[aria-label="${name}"]`)!;
const undoable = () => !button('Undo').hasAttribute('data-disabled');
const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => { (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })); });

describe('VideoEditor shortcuts', () => {
  it('runs its keys while focus is inside the editor, and the buttons announce them', async () => {
    await act(async () => root.render(<VideoEditor samples={false} />));
    expect(undoable()).toBe(false);
    act(() => editor().focus());
    press('t');
    // T added a title: there is something to undo now, and ⌘Z (Ctrl+Z off Apple platforms) takes it back.
    expect(undoable()).toBe(true);
    press('z', { ctrlKey: true });
    press('z', { metaKey: true });
    expect(undoable()).toBe(false);
    expect(button('Add a title').getAttribute('aria-keyshortcuts')).toBe('T');
    expect(button('Undo').getAttribute('aria-keyshortcuts')).toMatch(/^(Meta|Control)\+Z$/);
  });

  it('leaves keys alone when focus is outside the editor, or in a text field inside it', async () => {
    const outside = document.createElement('input');
    document.body.append(outside);
    await act(async () => root.render(<VideoEditor samples={false} />));
    act(() => outside.focus());
    press('t');
    expect(undoable()).toBe(false);
    const field = document.createElement('input');
    editor().append(field);
    act(() => field.focus());
    press('t');
    expect(undoable()).toBe(false);
    field.remove();
    outside.remove();
  });
});

describe('VideoEditor side panels', () => {
  // happy-dom lays nothing out: give every box a phone's width, so the panels are drawers over the viewer.
  beforeEach(() => { Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 500 }); });
  afterEach(() => { delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth; });
  it('opens the media library as a drawer from its toggle, and Escape closes it', async () => {
    await act(async () => root.render(<VideoEditor samples={false} />));
    const toggle = button('Media');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const drawer = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Media"]')!;
    expect(drawer().hidden).toBe(true);
    await act(async () => toggle.click());
    expect(drawer().hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).not.toBeNull();
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    press('Escape');
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(drawer().hasAttribute('data-open')).toBe(false);
  });
});

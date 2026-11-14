// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLProvider } from '@/lib/theme';
import type { Tool } from './surface';
import { InsertBar, type Inserts } from './toolbar';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
});

const inserts: Inserts = { sticky: vi.fn(), shape: vi.fn(), text: vi.fn(), art: vi.fn(), file: vi.fn(), link: vi.fn() };
function Bar() {
  const [tool, setTool] = useState<Tool>('select');
  return <InsertBar tool={tool} setTool={setTool} inserts={inserts} />;
}
const tool = (label: string) => document.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
const pressed = () => ['Select (V)', 'Move the board (H)', 'Draw (P)', 'Connector (C)'].filter((l) => tool(l).getAttribute('aria-pressed') === 'true');

describe('Freeform insert bar', () => {
  it('draws its mode tools as toggles: exactly one pressed, and releasing a mode goes back to Select', async () => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => root!.render(<BLProvider><Bar /></BLProvider>));
    expect(pressed()).toEqual(['Select (V)']);
    await act(async () => tool('Draw (P)').click());
    expect(pressed()).toEqual(['Draw (P)']);
    await act(async () => tool('Connector (C)').click());
    expect(pressed()).toEqual(['Connector (C)']);
    await act(async () => tool('Connector (C)').click());
    expect(pressed()).toEqual(['Select (V)']);
    // Select stays pressed when pressed again.
    await act(async () => tool('Select (V)').click());
    expect(pressed()).toEqual(['Select (V)']);
    // Insert actions are plain buttons, not toggles.
    expect(tool('Text box').hasAttribute('aria-pressed')).toBe(false);
  });
});

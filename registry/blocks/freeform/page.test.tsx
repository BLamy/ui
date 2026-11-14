// @vitest-environment happy-dom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { BLProvider } from '@/lib/theme';
import { SAMPLE_BOARDS } from './data';
import { FormatPanel } from './inspector';
import Freeform from './page';
import { FreeformProvider, useFreeform } from './store';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom lays nothing out: BLProvider's root is `width` px wide, everything else keeps happy-dom's zero box. */
let width = 1000;
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  ?? Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get(this: HTMLElement) { return this.getAttribute('data-slot') === 'bl-provider' ? width : clientWidth.get!.call(this); },
});
afterAll(() => { Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth); });
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
  width = 1000;
});
async function show(node: React.ReactNode) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(node); await new Promise((r) => setTimeout(r, 0)); });
}
const newBoard = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('New Board') || b.getAttribute('aria-label') === 'New Board');

describe('Freeform', () => {
  it('is compact in a compact BLProvider scope: the gallery drops its button labels', async () => {
    width = 400;
    await show(<Freeform />);
    expect(document.querySelector('[data-slot="bl-provider"]')?.getAttribute('data-size-class')).toBe('compact');
    expect(newBoard()?.textContent).toBe('');
    expect(newBoard()?.getAttribute('aria-label')).toBe('New Board');
  });

  it('shows the labels in a wider scope', async () => {
    width = 900;
    await show(<Freeform />);
    expect(newBoard()?.textContent).toContain('New Board');
  });
});

let api: ReturnType<typeof useFreeform> | null = null;
function Selected({ id }: { id: string }) {
  const f = useFreeform();
  api = f;
  useEffect(() => { f.select([id]); }, []);
  return <FormatPanel />;
}

describe('Freeform Format panel colors', () => {
  it('are one-of-many toggles: the current color is pressed, "No fill" maps to null, arrows move between them', async () => {
    await show(
      <BLProvider>
        <FreeformProvider boards={SAMPLE_BOARDS} openId="board-launch"><Selected id="l-research" /></FreeformProvider>
      </BLProvider>,
    );
    const fill = document.querySelector<HTMLElement>('[role="group"][aria-label="Fill"]')!;
    const swatch = (label: string) => fill.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
    const pressed = () => [...fill.querySelectorAll('[aria-pressed="true"]')].map((b) => b.getAttribute('aria-label'));
    expect(pressed()).toEqual(['#A8DCFF']);
    expect(swatch('#A8DCFF').hasAttribute('data-pressed')).toBe(true);

    await act(async () => swatch('#FF453A').click());
    expect(pressed()).toEqual(['#FF453A']);
    expect((api!.byId.get('l-research') as { fill: string | null }).fill).toBe('#FF453A');

    await act(async () => swatch('No fill').click());
    expect(pressed()).toEqual(['No fill']);
    expect((api!.byId.get('l-research') as { fill: string | null }).fill).toBeNull();

    // Pressing the current color again keeps it.
    await act(async () => swatch('No fill').click());
    expect(pressed()).toEqual(['No fill']);
    // One tab stop for the whole row.
    expect([...fill.querySelectorAll('button')].filter((b) => b.tabIndex === 0)).toHaveLength(1);
  });
});

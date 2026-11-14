// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rail } from './components/rail';
import CodexClone from './page';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
// framer-motion's WAAPI animations cancel with an AbortError in happy-dom.
MotionGlobalConfig.skipAnimations = true;

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
});
async function render(tree: React.ReactNode) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(tree); await new Promise((r) => setTimeout(r, 0)); });
}
const named = (label: string) => document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

describe('Codex rail', () => {
  it('is one choice of sections: a named group with one tab stop and the current section pressed', async () => {
    await render(<Rail />);
    const group = document.querySelector('[role="group"][aria-label="Sections"]')!;
    expect(group).toBeTruthy();
    const items = [...group.querySelectorAll<HTMLElement>('button')];
    expect(items.filter((b) => b.getAttribute('tabindex') !== '-1')).toHaveLength(1);
    expect(named('Home')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => named('Recent')!.click());
    expect(named('Recent')?.getAttribute('aria-pressed')).toBe('true');
    expect(named('Home')?.getAttribute('aria-pressed')).toBe('false');
    // Pressing the current section keeps it.
    await act(async () => named('Recent')!.click());
    expect(named('Recent')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Codex document tools', () => {
  it('Format text is a toggle that says whether the formatting bar is on', async () => {
    await render(<CodexClone initialChat="dot" />);
    const format = named('Format text')!;
    expect(format.hasAttribute('data-disabled')).toBe(false);
    expect(format.getAttribute('aria-pressed')).toBe('false');
    await act(async () => format.click());
    expect(format.getAttribute('aria-pressed')).toBe('true');
  });
});

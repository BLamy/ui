// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { StateToggle } from './lists';
import { DiffView } from './parts';
import GithubClone from './page';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom lays nothing out: the block's box reports `width` px wide, everything else nothing (unmeasured). */
let width = 0;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get(this: HTMLElement) { return this.classList.contains('@container/gh') ? width : 0; },
});
afterAll(() => { Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth'); });
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
  width = 0;
});
async function show(node: React.ReactNode) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(node); await new Promise((r) => setTimeout(r, 0)); });
}
/** The green "Code ▾" button (not the Code tab). */
const cloneButton = () => [...document.querySelectorAll<HTMLElement>('button')].filter((b) => b.textContent === 'Code' && b.getAttribute('role') !== 'tab').pop();
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('GitHub clone', () => {
  it('Open / Closed is one group that always has one pressed', async () => {
    const onChange = vi.fn();
    await show(<StateToggle value="open" onChange={onChange} open={3} closed={9} closedIcon="check" />);
    const group = document.querySelector('[aria-label="State"]');
    expect(group?.getAttribute('role')).toBe('group');
    const [open, closed] = [...group!.querySelectorAll<HTMLElement>('button')];
    expect(open!.getAttribute('aria-pressed')).toBe('true');
    expect(closed!.getAttribute('aria-pressed')).toBe('false');
    await act(async () => open!.click());
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => closed!.click());
    expect(onChange).toHaveBeenCalledWith('closed');
  });

  it("presents the Clone dialog from the block's own size class", async () => {
    width = 420;
    await show(<GithubClone keychain={false} />);
    await settle();
    // The phone layout: a NavigationStack with the repository picker in its bar.
    expect(document.querySelector('[aria-label="Choose repository"]')).toBeTruthy();
    const code = cloneButton();
    expect(code).toBeTruthy();
    await act(async () => { code!.click(); await new Promise((r) => setTimeout(r, 0)); });
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent?.includes('Clone'));
    expect(dialog?.getAttribute('data-presentation')).toBe('sheet');
  });

  it('is a card on a wide block', async () => {
    width = 1280;
    await show(<GithubClone keychain={false} />);
    await settle();
    const code = cloneButton();
    await act(async () => { code!.click(); await new Promise((r) => setTimeout(r, 0)); });
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent?.includes('Clone'));
    expect(dialog?.getAttribute('data-presentation')).toBe('dialog');
  });

  it('a changed file folds on a Collapsible: the chevron is named by the path and says whether it is expanded', async () => {
    await show(<DiffView path="src/app.ts" patch={'@@ -1,1 +1,1 @@\n-const a = 1;\n+const a = 2;'} add={1} del={1} />);
    const trigger = document.querySelector<HTMLElement>('button[aria-label="src/app.ts"]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!)!;
    expect(panel.textContent).toContain('const a = 2;');
    await act(async () => trigger.click());
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('data-open')).toBe(false);
    await act(async () => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});

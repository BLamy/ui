/* Shared setup for the agent-readiness tests (src/agent/agent.*.test.tsx): the DOM gaps happy-dom leaves (popovers, animations,
   layout), one place to render a scenario inside BLProvider, and the checks every file repeats. Each test file
   creates its own bridge with `createAgent` (it has no destroy), renders, and drives the page only through
   `agent.snapshot()` / `agent.act()` / `agent.query()`, the same three tools a model gets. */
import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import type { AgentComponent, AgentStep, createAgent } from '@ui-sdk/react/agent';
import { expect } from 'vitest';
import { BLProvider } from '@/lib/theme';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

// Assigned rather than `??=`: happy-dom has some of these without the parts that matter.
const nothing = () => undefined;
HTMLElement.prototype.showPopover = nothing;
HTMLElement.prototype.hidePopover = nothing;
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = nothing;
Element.prototype.checkVisibility = () => true;
Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
globalThis.ResizeObserver ??= class {
  observe = nothing;
  unobserve = nothing;
  disconnect = nothing;
};
document.head.append(Object.assign(document.createElement('style'), { textContent: '[popover] { display: block !important }' }));

/** Waits a tick (parts register, and some state arrives, after mounting). */
export const settle = (ms = 0) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

/** Renders a scenario inside BLProvider, the kit's root, and lets it settle. */
export async function mount(ui: ReactNode) {
  const view = render(<BLProvider>{ui}</BLProvider>);
  await settle();
  return view;
}

/** The entries an agent sees on the page right now. */
export const onPage = (snapshot: AgentComponent[]) => snapshot.filter((entry) => !entry.offPage && entry.component !== 'more');

/** Every entry has a name, and each of `labels` is one of them. Returns the entries for further checks. */
export function expectNamed(snapshot: AgentComponent[], labels: string[]) {
  const entries = onPage(snapshot);
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  const names = entries.map((entry) => entry.label);
  for (const label of labels) expect(names, `${label} is missing from the snapshot`).toContain(label);
  return entries;
}

/** The one on-page entry named `label`. */
export function entry(snapshot: AgentComponent[], label: string) {
  const found = onPage(snapshot).filter((e) => e.label === label);
  expect(found, `expected one entry named ${label}`).toHaveLength(1);
  return found[0] as AgentComponent & Record<string, unknown>;
}

type Bridge = Pick<ReturnType<typeof createAgent>, 'act'>;

/** Runs `agent.act` the way a page sees it: outside React's `act()`, which would hold back the renders a step waits
    for (a menu's items, a dialog's buttons), then lets the page settle. */
export async function actOn(agent: Bridge, steps: AgentStep[]) {
  const reactAct = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const was = reactAct.IS_REACT_ACT_ENVIRONMENT;
  reactAct.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    return await agent.act({ steps });
  } finally {
    reactAct.IS_REACT_ACT_ENVIRONMENT = was;
    await settle();
  }
}

/** `actOn`, failing with the bridge's own message when a step fails. */
export async function run(agent: Bridge, steps: AgentStep[]) {
  const result = await actOn(agent, steps);
  expect(result.ok, result.error?.message).toBe(true);
  return result;
}

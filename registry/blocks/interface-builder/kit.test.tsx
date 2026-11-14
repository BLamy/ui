// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLProvider } from '@/lib/theme';
import { makeNode, specOf } from './catalog';
import type { Node } from './model';
import type { RenderArgs } from './spec';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

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

/** A node drawn the way the canvas and the preview draw it, with its slots and children already drawn. */
const draw = (node: Node, extra: Partial<RenderArgs> = {}): ReactNode =>
  specOf(node.type).render({ node, p: node.props, on: {}, wired: () => false, children: null, childList: [], slots: {}, box: {}, live: true, ...extra });

describe('the kit’s Popover and Tooltip, live', () => {
  it('makes one Button in a Popover’s trigger slot the trigger itself', async () => {
    const pop = makeNode('Popover');
    const trigger = pop.slots!.trigger[0];
    // The node's own box, as the canvas wraps every node.
    await act(async () => root.render(<BLProvider>{draw(pop, { slots: { trigger: <div data-ib-node>{draw(trigger)}</div> }, children: <p>Body</p> })}</BLProvider>));
    const buttons = host.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    const button = buttons[0];
    expect(button.textContent).toBe('Details');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('span[aria-haspopup]')).toBeNull();
    await act(async () => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const dialog = document.querySelector('[role=dialog]')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe(button.id);
  });

  it('puts other trigger content in a plain button, and names the popover by its title', async () => {
    const pop = { ...makeNode('Popover'), props: { ...makeNode('Popover').props, title: 'Watering' } };
    const text = makeNode('Text');
    await act(async () => root.render(<BLProvider>{draw({ ...pop, slots: { trigger: [text] } }, { slots: { trigger: <span>More</span> }, children: <p>Body</p> })}</BLProvider>));
    const button = host.querySelector('button')!;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.textContent).toBe('More');
    await act(async () => button.click());
    const dialog = document.querySelector('[role=dialog]')!;
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Watering');
  });

  it('puts a Tooltip’s description on the Button people focus', async () => {
    const node = makeNode('Tooltip');
    await act(async () => root.render(<BLProvider>{draw(node, { children: draw(node.children![0]) })}</BLProvider>));
    const buttons = host.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('Hover me');
    const button = buttons[0];
    await act(async () => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      button.focus();
      await new Promise((r) => setTimeout(r, 800));
    });
    const tip = document.querySelector('[role=tooltip]');
    expect(tip?.textContent).toBe('Add a plant');
    expect(button.getAttribute('aria-describedby')).toBe(tip!.id);
  });
});

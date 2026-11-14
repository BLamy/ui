// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DebugToolbar, DebugToolbarButton } from './debug-toolbar';
import { ToolbarButton, ToolbarSeparator } from './toolbar';

beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

/** The button's name: its aria-label, or the text of what aria-labelledby points at (the tooltip). */
function accessibleName(b: Element) {
  const label = b.getAttribute('aria-label');
  if (label) return label;
  const ids = b.getAttribute('aria-labelledby')?.split(' ') ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
}

function mount(el: React.ReactElement) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(el));
  return host;
}

describe('DebugToolbar', () => {
  it('is a named toolbar with one tab stop and arrow keys between actions', () => {
    const onAction = vi.fn();
    const el = mount(<DebugToolbar onAction={onAction} disabledActions={['stop']} />);
    const bar = el.querySelector('[role="toolbar"]')!;
    expect(bar.getAttribute('aria-label')).toBe('Debugger controls');
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons).toHaveLength(8);
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    act(() => buttons[0].focus());
    act(() => { buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(document.activeElement).toBe(buttons[1]);
    act(() => buttons[1].click());
    expect(onAction).toHaveBeenCalledWith('step-over');
    const stop = buttons[7];
    expect(stop.getAttribute('aria-disabled')).toBe('true');
    act(() => stop.click());
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('names every action, reaches the ends with Home / End, keeps disabled actions in the arrow order, and runs Enter', () => {
    const onAction = vi.fn();
    const el = mount(<DebugToolbar onAction={onAction} disabledActions={['step-back', 'reverse-continue']} size="sm" />);
    const bar = el.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(bar.getAttribute('data-size')).toBe('sm');
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.map(accessibleName)).toEqual([
      'Continue', 'Step over', 'Step into', 'Step out', 'Step back', 'Reverse continue', 'Restart', 'Stop',
    ]);
    expect(buttons[0].className).toContain('size-7');
    const key = (target: Element, k: string) => act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); });
    act(() => buttons[0].focus());
    key(buttons[0], 'End');
    expect(document.activeElement).toBe(buttons[7]);
    key(buttons[7], 'Home');
    expect(document.activeElement).toBe(buttons[0]);
    act(() => buttons[3].focus());
    key(buttons[3], 'ArrowRight');
    expect(document.activeElement).toBe(buttons[4]);
    expect(buttons[4].getAttribute('aria-disabled')).toBe('true');
    act(() => buttons[4].click());
    expect(onAction).not.toHaveBeenCalled();
    act(() => buttons[6].focus());
    act(() => buttons[6].click());
    expect(onAction).toHaveBeenLastCalledWith('restart');
  });

  it('shows only the given actions, in the given order, and forwards style', () => {
    const onAction = vi.fn();
    const el = mount(<DebugToolbar onAction={onAction} actions={['stop', 'continue', 'step-back']} style={{ maxWidth: 200 }} />);
    const bar = el.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(bar.style.maxWidth).toBe('200px');
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.map((b) => b.dataset.action)).toEqual(['stop', 'continue', 'step-back']);
    expect(buttons.map(accessibleName)).toEqual(['Stop', 'Continue', 'Step back']);
    act(() => buttons[2].click());
    expect(onAction).toHaveBeenCalledWith('step-back');
  });

  it('has no title attributes, colors by tone, and is a floating card unless told otherwise', () => {
    const el = mount(<DebugToolbar onAction={() => {}} />);
    const bar = el.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(bar.getAttribute('data-variant')).toBe('floating');
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.some((b) => b.hasAttribute('title'))).toBe(false);
    expect(buttons[7].className).toContain('text-destructive');
    expect(buttons[6].className).toContain('text-success');
    expect(bar.querySelector('.codicon-gripper')).toBeNull();
    act(() => root!.render(<DebugToolbar variant="plain" aria-label="Debugger" onAction={() => {}} />));
    expect(bar.getAttribute('data-variant')).toBe('plain');
    expect(bar.getAttribute('aria-label')).toBe('Debugger');
  });

  it('composes: DebugToolbarButtons with your own labels and controls join one arrow-key order', () => {
    const onAction = vi.fn();
    const onDevTools = vi.fn();
    const el = mount(
      <DebugToolbar onAction={onAction} disabledActions={['stop']}>
        <DebugToolbarButton action="continue" label="Resume" />
        <DebugToolbarButton action="stop" />
        <ToolbarSeparator />
        <ToolbarButton onClick={onDevTools}>DevTools</ToolbarButton>
      </DebugToolbar>,
    );
    const bar = el.querySelector<HTMLElement>('[role="toolbar"]')!;
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.map((b) => accessibleName(b) || b.textContent)).toEqual(['Resume', 'Stop', 'DevTools']);
    expect(buttons[1].getAttribute('aria-disabled')).toBe('true');
    act(() => buttons[0].focus());
    act(() => { buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    expect(document.activeElement).toBe(buttons[2]);
    act(() => buttons[0].click());
    act(() => buttons[2].click());
    expect(onAction).toHaveBeenCalledWith('continue');
    expect(onDevTools).toHaveBeenCalledTimes(1);
  });
});

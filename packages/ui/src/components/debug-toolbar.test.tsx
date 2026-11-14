// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DebugToolbar } from './debug-toolbar';

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
    const el = mount(<DebugToolbar onAction={onAction} disabledActions={['step-back', 'reverse-continue']} size="compact" />);
    const bar = el.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(bar.getAttribute('data-size')).toBe('compact');
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Continue', 'Step over', 'Step into', 'Step out', 'Step back', 'Reverse continue', 'Restart', 'Stop',
    ]);
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
});

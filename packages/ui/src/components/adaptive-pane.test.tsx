// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdaptivePane } from '@/components/ui/adaptive-pane';

const rect = (w: number) => ({ width: w, left: 0, right: w, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

afterEach(cleanup);

/** The host the pane sits in; happy-dom has no layout, so it is told how wide it is. */
const wide = (host: Element) => Object.defineProperty(host, 'clientWidth', { value: 800, configurable: true });

describe('AdaptivePane resizing', () => {
  it('has no divider unless resizable', () => {
    render(<AdaptivePane mode="column" columnWidth={200}>x</AdaptivePane>);
    expect(screen.queryByRole('separator')).toBeNull();
  });
  it('resizes a column with the keyboard, clamps, and resets', () => {
    const onResize = vi.fn();
    const { container } = render(
      <div><AdaptivePane mode="column" columnWidth={200} resizable minWidth={150} maxWidth={260} onResize={onResize}>x</AdaptivePane></div>,
    );
    wide(container.firstElementChild!);
    const pane = container.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!;
    pane.getBoundingClientRect = () => rect(200);
    const handle = screen.getByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onResize).toHaveBeenLastCalledWith(216, 'column');
    expect(pane.style.width).toBe('216px');
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onResize).toHaveBeenLastCalledWith(260, 'column');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onResize).toHaveBeenLastCalledWith(150, 'column');
    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(onResize).toHaveBeenLastCalledWith(undefined, 'column');
    expect(pane.style.width).toBe('200px');
  });
  it('widens a right-hand pane by dragging left', () => {
    const onResize = vi.fn();
    const { container } = render(
      <div><AdaptivePane mode="column" side="right" columnWidth={200} resizable onResize={onResize}>x</AdaptivePane></div>,
    );
    wide(container.firstElementChild!);
    container.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!.getBoundingClientRect = () => rect(200);
    const handle = screen.getByRole('separator');
    handle.setPointerCapture = () => undefined;
    fireEvent.pointerDown(handle, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 450, pointerId: 1 });
    expect(onResize).toHaveBeenLastCalledWith(250, 'column');
  });
  it('resizes a drawer separately from its column', () => {
    const onResize = vi.fn();
    const { container } = render(
      <div><AdaptivePane mode="drawer" open drawerWidth={240} resizable onResize={onResize}>x</AdaptivePane></div>,
    );
    wide(container.firstElementChild!);
    const drawer = container.querySelector<HTMLElement>('[data-slot=edge-drawer]')!;
    drawer.getBoundingClientRect = () => rect(240);
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight', shiftKey: true });
    expect(onResize).toHaveBeenLastCalledWith(288, 'drawer');
    expect(drawer.style.getPropertyValue('--edge-drawer-w')).toBe('288px');
  });
});

describe('AdaptivePane drawer edge', () => {
  it('renders the open strip only when closed and given onOpen', () => {
    const { container, rerender } = render(<AdaptivePane mode="drawer" open={false} onOpen={() => undefined}>x</AdaptivePane>);
    expect(container.querySelector('[data-slot=adaptive-pane-edge]')).not.toBeNull();
    rerender(<AdaptivePane mode="drawer" open onOpen={() => undefined}>x</AdaptivePane>);
    expect(container.querySelector('[data-slot=adaptive-pane-edge]')).toBeNull();
    rerender(<AdaptivePane mode="drawer" open={false}>x</AdaptivePane>);
    expect(container.querySelector('[data-slot=adaptive-pane-edge]')).toBeNull();
  });
});

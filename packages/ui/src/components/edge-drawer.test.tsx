// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EdgeDrawer, useKeptChildren } from '@/components/ui/edge-drawer';

beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
});
afterEach(cleanup);

/* happy-dom rejects a cancelled animation's `finished` promise whether or not anyone reads it; a browser doesn't. */
const animate = Element.prototype.animate;
Element.prototype.animate = function (...args: Parameters<typeof animate>) {
  const animation = animate.apply(this, args);
  animation.finished.catch(() => undefined);
  return animation;
};

function Drawer({ onOpenChange, swipe, modal }: { onOpenChange?: (open: boolean, details: { reason: string; cancel: () => void; readonly canceled: boolean }) => void; swipe?: boolean; modal?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button">Outside</button>
      <EdgeDrawer open={open} aria-label="Menu" width={280} maxWidth="80%" swipe={swipe} modal={modal}
        onOpenChange={(next, details) => { onOpenChange?.(next, details); if (!details.canceled) setOpen(next); }}>
        <button type="button">Inside</button>
      </EdgeDrawer>
    </div>
  );
}

const host = () => document.querySelector<HTMLElement>('[data-slot=edge-drawer-host]')!;
const scrim = () => document.querySelector<HTMLElement>('[data-edge-drawer-scrim]')!;

describe('EdgeDrawer', () => {
  it('beside a usable page when not modal: no scrim, nothing inert, and Escape still closes it', () => {
    const onOpenChange = vi.fn();
    render(<Drawer modal={false} onOpenChange={onOpenChange} />);
    const panel = screen.getByRole('dialog', { name: 'Menu' });
    expect(panel.getAttribute('aria-modal')).toBeNull();
    expect(document.querySelector('[data-edge-drawer-scrim]')).toBeNull();
    const outside = screen.getByRole('button', { name: 'Outside' });
    expect(outside.closest('[inert]')).toBeNull();
    expect((outside as HTMLElement & { inert?: boolean }).inert).toBeFalsy();
    const inside = screen.getByRole('button', { name: 'Inside' });
    act(() => inside.focus());
    act(() => { fireEvent.keyDown(inside, { key: 'Escape' }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('is a layer host in its markup, around a named panel with its own hooks', () => {
    render(<Drawer />);
    expect(host().hasAttribute('data-layer-host')).toBe(true);
    expect(host().className).toContain('[contain:layout]');
    const panel = screen.getByRole('dialog', { name: 'Menu' });
    // UI SDK writes the parts' data-slot; the kit's hooks are separate attributes.
    expect(panel.hasAttribute('data-edge-drawer')).toBe(true);
    expect(panel.getAttribute('data-slot')).toBe('drawer-content');
    expect(scrim().getAttribute('data-slot')).toBe('drawer-backdrop');
    expect(panel.style.getPropertyValue('--edge-drawer-w')).toBe('280px');
    expect(panel.style.getPropertyValue('--edge-drawer-max-w')).toBe('80%');
    // Swiping is on unless turned off.
    expect(panel.hasAttribute('data-drawer-no-drag')).toBe(false);
  });

  it('closes on Escape and on a press of the scrim, with the reason', () => {
    const onOpenChange = vi.fn();
    render(<Drawer onOpenChange={onOpenChange} />);
    act(() => { fireEvent.keyDown(screen.getByRole('dialog', { name: 'Menu' }), { key: 'Escape' }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
    cleanup();
    render(<Drawer onOpenChange={onOpenChange} />);
    act(() => {
      fireEvent.pointerDown(scrim(), { button: 0, pointerType: 'mouse' });
      fireEvent.pointerUp(scrim(), { button: 0, pointerType: 'mouse' });
      fireEvent.click(scrim());
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'outside-press' }));
  });

  it('stays open when the change is canceled', () => {
    render(<Drawer onOpenChange={(_open, details) => details.cancel()} />);
    act(() => { fireEvent.keyDown(screen.getByRole('dialog', { name: 'Menu' }), { key: 'Escape' }); });
    expect(screen.getByRole('dialog', { name: 'Menu' }).hasAttribute('data-open')).toBe(true);
  });

  it('opts its panel out of the drag with swipe={false}', () => {
    render(<Drawer swipe={false} />);
    expect(screen.getByRole('dialog', { name: 'Menu' }).hasAttribute('data-drawer-no-drag')).toBe(true);
  });
});

describe('useKeptChildren', () => {
  function Moving({ where }: { where: 'a' | 'b' }) {
    const kept = useKeptChildren(<Field />);
    return (
      <>
        {kept.portal}
        {where === 'a' ? <section aria-label="A"><div ref={kept.dock}>{kept.inline}</div></section> : null}
        {where === 'b' ? <section aria-label="B"><div ref={kept.dock}>{kept.inline}</div></section> : null}
      </>
    );
  }
  function Field() {
    const [text, setText] = useState('');
    return <input aria-label="Draft" value={text} onChange={(e) => setText(e.target.value)} />;
  }

  it('moves the same children, with their state, between docks', () => {
    const { rerender } = render(<Moving where="a" />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Draft' });
    fireEvent.change(input, { target: { value: 'kept' } });
    expect(screen.getByRole('region', { name: 'A' }).contains(input)).toBe(true);
    rerender(<Moving where="b" />);
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(input);
    expect(screen.getByRole('region', { name: 'B' }).contains(input)).toBe(true);
    expect(input.value).toBe('kept');
  });
});

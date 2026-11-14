// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sidebar, SidebarInset, SidebarItem, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

/** happy-dom has no layout: every element reports this width, which `bindSizeClass` reads. */
let width = 900;
beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
});
afterEach(() => {
  cleanup();
  width = 900;
});

function Field() {
  const [text, setText] = useState('');
  return <input aria-label="Filter" value={text} onChange={(e) => setText(e.target.value)} />;
}

function Shell({ variant = 'docked' as const, onOpenChange }: { variant?: 'docked' | 'rail' | 'overlay'; onOpenChange?: (open: boolean, details: { reason: string }) => void }) {
  return (
    <SidebarProvider defaultOpen={variant !== 'overlay'} onOpenChange={onOpenChange}>
      <Sidebar variant={variant}>
        <Field />
        <SidebarItem icon="home" label="Home" active />
      </Sidebar>
      <SidebarInset><SidebarTrigger /><State /></SidebarInset>
    </SidebarProvider>
  );
}
function State() {
  const s = useSidebar();
  return <output aria-label="state">{`${s.open ? 'open' : 'closed'} ${s.sizeClass}`}</output>;
}

describe('Sidebar', () => {
  it('toggles from its trigger, which says whether it is expanded', () => {
    const onOpenChange = vi.fn();
    render(<Shell onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    act(() => { fireEvent.click(trigger); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'trigger-press' }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('status', { name: 'state' }).textContent).toBe('closed medium');
    // A closed docked sidebar is out of the tab order, and the trigger names it as what it controls.
    const panel = document.querySelector<HTMLElement>('[data-slot=sidebar-panel]')!;
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.id).toBeTruthy();
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('measures again when its breakpoint changes', () => {
    width = 700;
    const onOpenChange = vi.fn();
    const { rerender } = render(<SidebarProvider breakpoint={560} onOpenChange={onOpenChange}><Sidebar>x</Sidebar><State /></SidebarProvider>);
    expect(screen.getByRole('status', { name: 'state' }).textContent).toBe('open medium');
    rerender(<SidebarProvider breakpoint={800} onOpenChange={onOpenChange}><Sidebar>x</Sidebar><State /></SidebarProvider>);
    expect(screen.getByRole('status', { name: 'state' }).textContent).toBe('closed compact');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'content-resize' }));
  });

  it("passes an item's click event through, and marks items without taking UI SDK's data-slot", () => {
    const onClick = vi.fn();
    render(<SidebarProvider><Sidebar><SidebarItem icon="home" label="Inbox" onClick={onClick} /></Sidebar></SidebarProvider>);
    const item = screen.getByRole('button', { name: 'Inbox' });
    act(() => { fireEvent.click(item); });
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }), expect.anything());
    expect(item.hasAttribute('data-sidebar-item')).toBe(true);
    expect(item.getAttribute('data-slot')).toBe('button');
  });

  it('collapses a rail to icons with named items', () => {
    render(<SidebarProvider defaultOpen={false}><Sidebar variant="rail"><SidebarItem icon="home" label="Home" /></Sidebar></SidebarProvider>);
    expect(screen.getByRole('button', { name: 'Home' }).textContent).toBe('');
  });

  it('presents the overlay variant as a named dialog that Escape closes', () => {
    const onOpenChange = vi.fn();
    render(<Shell variant="overlay" onOpenChange={onOpenChange} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' })); });
    const dialog = screen.getByRole('dialog', { name: 'Sidebar' });
    expect(dialog.getAttribute('data-variant')).toBe('panel');
    act(() => { fireEvent.keyDown(dialog, { key: 'Escape' }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('starts closed in a compact provider without reporting a change it was never asked for', () => {
    width = 390;
    const onOpenChange = vi.fn();
    render(<Shell onOpenChange={onOpenChange} />);
    expect(screen.getByRole('status', { name: 'state' }).textContent).toBe('closed compact');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('a controlled parent keeps what it passed through the first measurement', () => {
    width = 390;
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <SidebarProvider open={open} onOpenChange={(next, details) => { onOpenChange(next, details); setOpen(next); }}>
          <Sidebar><SidebarItem icon="home" label="Home" /></Sidebar>
          <SidebarInset><State /></SidebarInset>
        </SidebarProvider>
      );
    }
    render(<Controlled />);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'state' }).textContent).toBe('open compact');
  });

  it('becomes a closed overlay in a compact provider', () => {
    width = 400;
    render(<Shell />);
    expect(screen.getByRole('status', { name: 'state' }).textContent).toBe('closed compact');
    expect(document.querySelector('[data-slot=sidebar-provider]')!.getAttribute('data-size-class')).toBe('compact');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' })); });
    expect(screen.getByRole('dialog', { name: 'Sidebar' })).toBeTruthy();
  });

  it('follows the reading direction: the overlay comes from the start, the docked panel closes toward it', async () => {
    // The page's direction: happy-dom has no top layer, so the drawer is portaled to the body.
    document.documentElement.style.direction = 'rtl';
    try {
      width = 400;
      const { unmount } = render(<Shell />);
      act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' })); });
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      const dialog = screen.getByRole('dialog', { name: 'Sidebar' });
      expect(dialog.getAttribute('data-side')).toBe('right');
      expect(dialog.className).toContain('ml-auto');
      expect(dialog.className).toContain('border-l');
      unmount();
      width = 900;
      render(<Shell />);
      act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' })); });
      const slide = document.querySelector<HTMLElement>('[data-slot=sidebar-panel] > div')!;
      expect(slide.className).toContain('rtl:translate-x-full');
    } finally {
      document.documentElement.style.direction = '';
    }
  });

  it('keeps its children mounted when the variant changes', () => {
    const { rerender } = render(<Shell variant="docked" />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Filter' });
    fireEvent.change(input, { target: { value: 'kept' } });
    rerender(<Shell variant="rail" />);
    expect(screen.getByRole('textbox', { name: 'Filter' })).toBe(input);
    expect(input.value).toBe('kept');
  });
});

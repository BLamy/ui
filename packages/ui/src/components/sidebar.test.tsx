// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  Sidebar, SidebarAccount, SidebarContent, SidebarInset, SidebarItem, SidebarProvider, SidebarSearch, SidebarSection, SidebarTrigger,
  useSidebar, type SidebarPresentation, type SidebarVariant,
} from '@/components/ui/sidebar';

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

function Shell({ variant = 'docked', presentation, defaultOpen, onOpenChange, onPick }: {
  variant?: SidebarVariant;
  presentation?: SidebarPresentation;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: { reason: string }) => void;
  onPick?: () => void;
}) {
  return (
    <SidebarProvider defaultOpen={defaultOpen ?? presentation !== 'drawer'} onOpenChange={onOpenChange}>
      <Sidebar variant={variant} presentation={presentation}>
        <Field />
        <SidebarContent aria-label="Pages">
          <SidebarSection title="Workspace">
            <SidebarItem icon="house" title="Home" current onClick={onPick} />
            <SidebarItem icon="tray" title="Inbox" trailing={4} />
          </SidebarSection>
        </SidebarContent>
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
    // A closed column is out of the tab order, and the trigger names it as what it controls.
    const panel = document.querySelector<HTMLElement>('[data-slot=sidebar-panel]')!;
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.id).toBeTruthy();
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('toggles from its shortcut', () => {
    const onOpenChange = vi.fn();
    render(
      <SidebarProvider onOpenChange={onOpenChange}>
        <Sidebar>x</Sidebar>
        <SidebarInset><SidebarTrigger shortcut="mod+b" /></SidebarInset>
      </SidebarProvider>,
    );
    const keys = screen.getByRole('button', { name: 'Toggle sidebar' }).getAttribute('aria-keyshortcuts')!;
    expect(keys).toMatch(/B/);
    const apple = keys.startsWith('Meta');
    act(() => { fireEvent.keyDown(document.body, { key: 'b', ctrlKey: !apple, metaKey: apple }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'shortcut' }));
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

  it("passes an item's click event through, marks the current row, and badges a number", () => {
    const onClick = vi.fn();
    render(<SidebarProvider><Sidebar><SidebarItem icon="house" title="Inbox" trailing={3} current onClick={onClick} /></Sidebar></SidebarProvider>);
    const item = screen.getByRole('button', { name: /Inbox/ });
    act(() => { fireEvent.click(item); });
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }), expect.anything());
    expect(item.hasAttribute('data-sidebar-item')).toBe(true);
    expect(item.getAttribute('data-slot')).toBe('button');
    expect(item.getAttribute('aria-current')).toBe('page');
    expect(item.querySelector('[data-slot=badge]')!.textContent).toBe('3');
  });

  it('takes className, style and DOM props on its rows, and works outside a Sidebar', () => {
    render(<SidebarItem title="Settings" className="extra" style={{ marginTop: 3 }} data-testid="row" tint="red" />);
    const item = screen.getByTestId('row');
    expect(item.className).toContain('extra');
    expect(item.style.marginTop).toBe('3px');
    expect(item.style.getPropertyValue('--sidebar-tint')).toBe('red');
    expect(item.getAttribute('aria-current')).toBeNull();
  });

  it('is a nav landmark with labelled groups', () => {
    render(<Shell />);
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Workspace' });
    expect(group.querySelectorAll('[data-sidebar-item]').length).toBe(2);
  });

  it('collapses a rail to its icons: rows keep their names, and the group keeps its label', () => {
    render(<Shell variant="rail" defaultOpen={false} />);
    const panel = document.querySelector<HTMLElement>('[data-slot=sidebar-panel]')!;
    expect(panel.hasAttribute('data-collapsed')).toBe(true);
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Workspace' })).toBeTruthy();
  });

  it('presents as a named drawer that Escape closes', () => {
    const onOpenChange = vi.fn();
    render(<Shell presentation="drawer" onOpenChange={onOpenChange} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' })); });
    const dialog = screen.getByRole('dialog', { name: 'Sidebar' });
    expect(dialog.getAttribute('data-variant')).toBe('panel');
    act(() => { fireEvent.keyDown(dialog, { key: 'Escape' }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('closes the drawer when one of its rows is pressed, unless the press is prevented', () => {
    const onOpenChange = vi.fn();
    let prevent = true;
    function Pick() {
      return <SidebarItem title="Stay" onClick={(event) => { if (prevent) event.preventDefault(); }} />;
    }
    render(
      <SidebarProvider defaultOpen={false} onOpenChange={onOpenChange}>
        <Sidebar presentation="drawer"><Pick /></Sidebar>
        <SidebarInset><SidebarTrigger /></SidebarInset>
      </SidebarProvider>,
    );
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Stay' })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    prevent = false;
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Stay' })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'action' }));
  });

  it('presses its search from its shortcut', () => {
    const onClick = vi.fn();
    render(<SidebarProvider><Sidebar><SidebarSearch shortcut="/" onClick={onClick} /></Sidebar></SidebarProvider>);
    const search = screen.getByRole('button', { name: /Search/ });
    expect(search.getAttribute('aria-keyshortcuts')).toBe('/');
    expect(search.querySelector('[data-slot=kbd]')).toBeTruthy();
    act(() => { fireEvent.keyDown(document.body, { key: '/' }); });
    expect(onClick).toHaveBeenCalledTimes(1);
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
          <Sidebar><SidebarItem icon="house" title="Home" /></Sidebar>
          <SidebarInset><State /></SidebarInset>
        </SidebarProvider>
      );
    }
    render(<Controlled />);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'state' }).textContent).toBe('open compact');
  });

  it('becomes a closed drawer in a compact provider (presentation="auto"), with phone-sized rows', () => {
    width = 400;
    render(<Shell />);
    expect(screen.getByRole('status', { name: 'state' }).textContent).toBe('closed compact');
    expect(document.querySelector('[data-slot=sidebar-provider]')!.getAttribute('data-size-class')).toBe('compact');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' })); });
    expect(screen.getByRole('dialog', { name: 'Sidebar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Home' }).className).toContain('min-h-11');
    expect(screen.getByRole('button', { name: 'Toggle sidebar' }).className).toContain('size-11');
  });

  it('stays a column in a compact provider with presentation="column"', () => {
    width = 400;
    render(<Shell presentation="column" />);
    expect(document.querySelector('[data-slot=sidebar-panel]')!.getAttribute('data-presentation')).toBe('column');
  });

  it('follows the reading direction: the drawer comes from the start, the column closes toward it', async () => {
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
      const slide = document.querySelector<HTMLElement>('[data-slot=sidebar-panel]')!;
      expect(slide.className).toContain('rtl:translate-x-full');
    } finally {
      document.documentElement.style.direction = '';
    }
  });

  it('keeps its children mounted when the variant or the presentation changes', () => {
    const { rerender } = render(<Shell variant="docked" />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Filter' });
    fireEvent.change(input, { target: { value: 'kept' } });
    rerender(<Shell variant="rail" />);
    expect(screen.getByRole('textbox', { name: 'Filter' })).toBe(input);
    rerender(<Shell variant="rail" presentation="drawer" defaultOpen />);
    expect(document.querySelector('[data-slot=sidebar-panel]')!.getAttribute('data-presentation')).toBe('drawer');
    expect(input.value).toBe('kept');
    expect(input.isConnected).toBe(true);
  });
});

describe('Sidebar root and account', () => {
  it('passes ref, id and data-* to its panel, the same element in both presentations', () => {
    const ref = { current: null as HTMLDivElement | null };
    const { rerender } = render(<SidebarProvider><Sidebar ref={ref} id="nav" data-testid="sb"><SidebarContent /></Sidebar></SidebarProvider>);
    const panel = screen.getByTestId('sb');
    expect(panel.id).toBe('nav');
    expect(panel.getAttribute('data-slot')).toBe('sidebar-panel');
    expect(ref.current).toBe(panel);
    rerender(<SidebarProvider><Sidebar ref={ref} id="nav" data-testid="sb" presentation="drawer"><SidebarContent /></Sidebar></SidebarProvider>);
    expect(ref.current?.id ?? 'nav').toBe('nav');
  });

  it('the account grows with the rows in a compact provider, so the heading is never smaller than its rows', () => {
    const { unmount } = render(<SidebarProvider><Sidebar presentation="column"><SidebarAccount title="Northwind" /></Sidebar></SidebarProvider>);
    expect(screen.getByText('Northwind').className).toContain('text-footnote');
    unmount();
    width = 400;
    render(<SidebarProvider defaultOpen><Sidebar presentation="column"><SidebarAccount title="Northwind" /></Sidebar></SidebarProvider>);
    expect(screen.getByText('Northwind').className).toContain('text-subhead');
  });
});

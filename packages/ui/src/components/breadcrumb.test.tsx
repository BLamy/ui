// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import {
  Breadcrumb, BreadcrumbItem, fitBreadcrumbs, type BreadcrumbItemData,
} from '@/components/ui/breadcrumb';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

describe('fitBreadcrumbs', () => {
  // Five items, 10px each, 2px between neighbours: 58px in all. The ellipsis item is 6px.
  const widths = [10, 10, 10, 10, 10];
  it('keeps everything when it fits', () => {
    expect(fitBreadcrumbs(widths, 58, 2, 6)).toEqual({ head: 5, tail: 0 });
    expect(fitBreadcrumbs(widths, 400, 2, 6)).toEqual({ head: 5, tail: 0 });
  });
  it('keeps the first and as many trailing items as fit, behind the ellipsis', () => {
    // 10 + … 6 + 3 × 10 + 4 gaps × 2 = 54
    expect(fitBreadcrumbs(widths, 57, 2, 6)).toEqual({ head: 1, tail: 3 });
    expect(fitBreadcrumbs(widths, 54, 2, 6)).toEqual({ head: 1, tail: 3 });
    // two trailing: 10 + 6 + 20 + 3 × 2 = 42
    expect(fitBreadcrumbs(widths, 53, 2, 6)).toEqual({ head: 1, tail: 2 });
    expect(fitBreadcrumbs(widths, 42, 2, 6)).toEqual({ head: 1, tail: 2 });
    expect(fitBreadcrumbs(widths, 41, 2, 6)).toEqual({ head: 1, tail: 1 });
  });
  it('always keeps the first and the last, even when that overflows', () => {
    expect(fitBreadcrumbs(widths, 5, 2, 6)).toEqual({ head: 1, tail: 1 });
  });
  it('weighs each item by its own width', () => {
    expect(fitBreadcrumbs([20, 100, 8, 8, 30], 92, 4, 10)).toEqual({ head: 1, tail: 3 }); // 20 + … 10 + 46 + 4 × 4
    expect(fitBreadcrumbs([20, 100, 8, 8, 30], 90, 4, 10)).toEqual({ head: 1, tail: 2 });
    expect(fitBreadcrumbs([20, 8, 100, 8, 30], 90, 4, 10)).toEqual({ head: 1, tail: 2 });
  });
  it('has nothing to hide with two or fewer items, or no known width', () => {
    expect(fitBreadcrumbs([40, 40], 10, 2, 6)).toEqual({ head: 2, tail: 0 });
    expect(fitBreadcrumbs([40], 10, 2, 6)).toEqual({ head: 1, tail: 0 });
    expect(fitBreadcrumbs([], 10, 2, 6)).toEqual({ head: 0, tail: 0 });
    expect(fitBreadcrumbs(widths, 0, 2, 6)).toEqual({ head: 5, tail: 0 });
  });
  it('honours keepHead and keepTail', () => {
    expect(fitBreadcrumbs(widths, 5, 2, 6, { keepHead: 2, keepTail: 2 })).toEqual({ head: 2, tail: 2 });
    // keepTail below 1 still keeps the current page and collapses the rest (tail 0 would mean "show everything").
    expect(fitBreadcrumbs([100, 100, 100, 100, 100], 150, 10, 20, { keepTail: 0 })).toEqual({ head: 1, tail: 1 });
    expect(fitBreadcrumbs([100, 100, 100, 100, 100], 150, 10, 20, { keepTail: -3 })).toEqual({ head: 1, tail: 1 });
    // Nothing is left to hide once the protected ends cover every item: all five stay.
    expect(fitBreadcrumbs(widths, 5, 2, 6, { keepHead: 2, keepTail: 3 })).toEqual({ head: 5, tail: 0 });
    expect(fitBreadcrumbs(widths, 5, 2, 6, { keepHead: 3, keepTail: 2 })).toEqual({ head: 5, tail: 0 });
  });
});

/* ── The DOM: happy-dom has no layout, so widths are told ──
   The measuring copy's rows are 8px per character + 12 (icons and padding), the `…` row is 24, every separator 16;
   the container is whatever `box.width` says, and the ResizeObserver fires when a test calls `resize`. */
const box = { width: 1000 };
const observers = new Set<() => void>();
const resize = (width: number) => {
  box.width = width;
  act(() => observers.forEach((notify) => notify()));
};

const proto = HTMLElement.prototype;
const original = {
  offsetWidth: Object.getOwnPropertyDescriptor(proto, 'offsetWidth'),
  clientWidth: Object.getOwnPropertyDescriptor(proto, 'clientWidth'),
  RO: globalThis.ResizeObserver,
};

beforeAll(() => {
  Object.defineProperty(proto, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.dataset.slot === 'breadcrumb-separator') return 16;
      if (this.tagName === 'LI' && this.closest('[data-slot=breadcrumb-measure]')) {
        const own = this.hasAttribute('data-ellipsis') ? 24 : (this.textContent ?? '').length * 8 + 12;
        return own + (this.querySelector('[data-slot=breadcrumb-separator]') ? 16 : 0);
      }
      return 0;
    },
  });
  Object.defineProperty(proto, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) { return this.dataset.slot === 'breadcrumb' ? box.width : 0; },
  });
  globalThis.ResizeObserver = class {
    private notify = () => this.callback([], this as unknown as ResizeObserver);
    constructor(private callback: ResizeObserverCallback) { observers.add(this.notify); }
    observe() { /* the test calls resize() */ }
    unobserve() { /* noop */ }
    disconnect() { observers.delete(this.notify); }
  };
});
afterAll(() => {
  for (const key of ['offsetWidth', 'clientWidth'] as const) {
    if (original[key]) Object.defineProperty(proto, key, original[key]);
    else delete (proto as unknown as Record<string, unknown>)[key];
  }
  globalThis.ResizeObserver = original.RO;
});
afterEach(() => { cleanup(); box.width = 1000; observers.clear(); });

const pressed = vi.fn();
const TRAIL: BreadcrumbItemData[] = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'projects', label: 'Projects', onClick: () => pressed('projects') },
  { id: 'design', label: 'Design system', href: '/design' },
  { id: 'components', label: 'Components', onClick: () => pressed('components') },
  { id: 'breadcrumb', label: 'Breadcrumb' },
];
afterEach(() => pressed.mockClear());

const press = (el: Element) => fireEvent.click(el);
/** Lets UI SDK commit what an event started (menus open and settle a tick later). */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const trail = () => screen.getByRole('navigation', { name: 'Breadcrumb' });
// The visible list only: the off-screen measuring copy repeats the text (aria-hidden), so `getByText` on the root would find it twice.
const list = () => trail().querySelector<HTMLElement>('[data-slot=breadcrumb-list]')!;
const labels = () => within(list()).getAllByRole('listitem').map((li) => li.textContent);

describe('Breadcrumb items', () => {
  it('renders links, the last one as the current page', () => {
    render(<Breadcrumb items={TRAIL} />);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Design system' }).getAttribute('href')).toBe('/design');
    // The current page is plain text: nothing to press, and not in the tab order.
    const current = within(list()).getByText('Breadcrumb').closest('[aria-current]')!;
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.tagName).toBe('SPAN');
    expect(within(list()).getAllByRole('listitem')).toHaveLength(5);
    expect(trail().querySelectorAll('[data-slot=breadcrumb-list] [aria-current]')).toHaveLength(1);
  });
  it('makes an item with only a handler a button, fires it, and hides separators from assistive tech', () => {
    render(<Breadcrumb items={TRAIL} />);
    press(screen.getByRole('button', { name: 'Projects' }));
    expect(pressed).toHaveBeenCalledWith('projects');
    const separators = trail().querySelectorAll('[data-slot=breadcrumb-list] [data-slot=breadcrumb-separator]');
    expect(separators).toHaveLength(4); // none after the current page
    separators.forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'));
  });
  it('lets the current page be pressable when it has a handler', () => {
    const onClick = vi.fn();
    render(<Breadcrumb items={[{ id: 'a', label: 'Docs', href: '/' }, { id: 'b', label: 'Reload', onClick }]} />);
    const current = screen.getByRole('button', { name: 'Reload' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.getAttribute('aria-disabled')).toBeNull();
    press(current);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('keeps a link a link when it also has a handler', () => {
    const onClick = vi.fn((event?: unknown) => event);
    render(<Breadcrumb items={[{ id: 'a', label: 'Docs', href: '#docs', onClick }, { id: 'b', label: 'Here' }]} />);
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.getAttribute('href')).toBe('#docs');
    press(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('composes from BreadcrumbItem children, with a size and a custom separator', () => {
    render(
      <Breadcrumb size="sm" separator="/">
        <BreadcrumbItem href="/a">A</BreadcrumbItem>
        <BreadcrumbItem href="/b">B</BreadcrumbItem>
      </Breadcrumb>,
    );
    expect(trail().className).toContain('text-caption');
    expect(screen.getByRole('link', { name: 'A' })).toBeTruthy();
    expect(trail().querySelector('[data-slot=breadcrumb-list] [data-slot=breadcrumb-separator]')!.textContent).toBe('/');
  });
});

describe('Breadcrumb siblings menu', () => {
  const siblings = [
    { id: 'ui', label: 'Components', onClick: () => pressed('ui') },
    { id: 'blocks', label: 'Blocks', onClick: () => pressed('blocks') },
    { id: 'docs', label: 'Docs', href: '/docs' },
  ];
  const withSiblings = () => (
    <Breadcrumb items={[
      { id: 'home', label: 'Home', href: '/' },
      { id: 'section', label: 'Components', items: siblings, selectedId: 'ui', onClick: () => pressed('own') },
      { id: 'here', label: 'Breadcrumb' },
    ]} />
  );
  it('opens the siblings, marks the current one and fires the chosen one', async () => {
    render(withSiblings());
    const trigger = screen.getByRole('button', { name: 'Components' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    press(trigger);
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'Components' });
    const rows = within(menu).getAllByRole('menuitemradio');
    expect(rows.map((r) => r.textContent)).toEqual(['Components', 'Blocks', 'Docs']);
    expect(rows.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(rows[2].getAttribute('href')).toBe('/docs');
    press(rows[1]);
    await settle();
    expect(pressed).toHaveBeenCalledWith('blocks');
    expect(pressed).not.toHaveBeenCalledWith('own');
    // Choosing closes the menu and gives focus back to the item.
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('opens with the keyboard, on the first sibling, and Escape closes it', async () => {
    render(withSiblings());
    const trigger = screen.getByRole('button', { name: 'Components' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await settle();
    const rows = within(screen.getByRole('menu')).getAllByRole('menuitemradio');
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    await settle();
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(rows[1], { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(pressed).not.toHaveBeenCalled();
  });
});

describe('Breadcrumb width', () => {
  it('changes a short source path into a collapsed framework path with dialog pickers', async () => {
    box.width = 280;
    const item = (id: string, label: string): BreadcrumbItemData => ({
      id, label, onClick: () => pressed(id), 'aria-haspopup': 'dialog', 'aria-expanded': false, 'aria-controls': `${id}-picker`,
    });
    const { rerender } = render(<Breadcrumb items={[item('sources', 'Sources'), item('src', 'src'), item('cart', 'cart.js')]} />);
    const src = screen.getByRole('button', { name: 'src' });
    expect(src.getAttribute('aria-haspopup')).toBe('dialog');
    expect(src.getAttribute('aria-expanded')).toBe('false');
    expect(src.getAttribute('aria-controls')).toBe('src-picker');
    rerender(<Breadcrumb items={[item('sources', 'Sources'), item('framework', 'Framework and generated code (1)'), item('node_modules', 'node_modules'), item('runtime', 'runtime.js')]} />);
    expect(screen.getByRole('button', { name: 'runtime.js' }).getAttribute('aria-haspopup')).toBe('dialog');
    press(screen.getByRole('button', { name: 'More' }));
    await settle();
    press(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Framework and generated code (1)' }));
    await settle();
    expect(pressed).toHaveBeenCalledWith('framework');
  });
  it('renders the full list first and when it fits', () => {
    box.width = 600;
    render(<Breadcrumb items={TRAIL} />);
    expect(labels()).toEqual(['Home', 'Projects', 'Design system', 'Components', 'Breadcrumb']);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });
  it('collapses the middle into a … menu when the container is narrow, and restores it when it widens', async () => {
    box.width = 320; // Home 44 + … 24 + Components 100 + Breadcrumb 92 + 4 × 16 = 324 does not fit; one fewer does
    render(<Breadcrumb items={TRAIL} />);
    // Home, …, Components, Breadcrumb: 44 + 24 + 100 + 92 + 3 × 16 = 308
    expect(labels()).toEqual(['Home', '', 'Components', 'Breadcrumb']);
    const more = screen.getByRole('button', { name: 'More' });

    press(more);
    await settle();
    const menu = screen.getByRole('menu', { name: 'More' });
    const rows = within(menu).getAllByRole('menuitem');
    expect(rows.map((r) => r.textContent)).toEqual(['Projects', 'Design system']);
    expect(rows[1].getAttribute('href')).toBe('/design');
    press(rows[0]);
    await settle();
    expect(pressed).toHaveBeenCalledWith('projects');
    expect(screen.queryByRole('menu')).toBeNull();

    resize(200); // only the first and the last
    expect(labels()).toEqual(['Home', '', 'Breadcrumb']);
    resize(700);
    expect(labels()).toEqual(['Home', 'Projects', 'Design system', 'Components', 'Breadcrumb']);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });
  it('re-measures when the items change', () => {
    box.width = 400; // the four fit (376)
    const { rerender } = render(<Breadcrumb items={TRAIL.slice(0, 4)} />);
    expect(labels()).toEqual(['Home', 'Projects', 'Design system', 'Components']);
    rerender(<Breadcrumb items={[...TRAIL.slice(0, 4), { id: 'extra', label: 'A much longer last item' }]} />);
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    expect(labels().at(-1)).toBe('A much longer last item');
  });
  it('does not collapse with collapse={false}', () => {
    box.width = 100;
    render(<Breadcrumb items={TRAIL} collapse={false} />);
    expect(labels()).toHaveLength(5);
  });
  it('shows everything when the container has no width yet', () => {
    box.width = 0;
    render(<Breadcrumb items={TRAIL} />);
    expect(labels()).toHaveLength(5);
  });
  it('keeps a hidden picker reachable as a submenu', async () => {
    box.width = 200;
    render(
      <Breadcrumb items={[
        { id: 'home', label: 'Home', href: '/' },
        { id: 'mid', label: 'Middle section', items: [{ id: 'a', label: 'Alpha', onClick: () => pressed('alpha') }, { id: 'b', label: 'Beta' }], selectedId: 'a' },
        { id: 'here', label: 'Current page here' },
      ]} />,
    );
    press(screen.getByRole('button', { name: 'More' }));
    await settle();
    const row = within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Middle section' });
    expect(row.getAttribute('aria-haspopup')).toBe('menu');
    row.focus();
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    await settle();
    const siblings = screen.getAllByRole('menuitemradio');
    expect(siblings.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    press(siblings[1]);
    await settle();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Breadcrumb names and rich content', () => {
  it('shows `children` while the menus read the plain `label`', async () => {
    box.width = 200;
    render(
      <Breadcrumb items={[
        { id: 'home', label: 'Home', href: '/' },
        { id: 'repo', label: 'ui-v6 repository', children: <b>ui-v6</b>, href: '/repo' },
        { id: 'here', label: 'Current page here' },
      ]} />,
    );
    press(screen.getByRole('button', { name: 'More' }));
    await settle();
    const row = within(screen.getByRole('menu')).getByRole('menuitem');
    expect(row.querySelector('b')?.textContent).toBe('ui-v6');
    expect(row.getAttribute('href')).toBe('/repo');
  });
  it('re-measures when a label changes without a new trail length', async () => {
    box.width = 400;
    const { rerender } = render(<Breadcrumb items={TRAIL.slice(0, 4)} />);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    const longer = TRAIL.slice(0, 4).map((item, i) => (i === 3 ? { ...item, label: 'Components and their parts' } : item));
    rerender(<Breadcrumb items={longer} />);
    await settle();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    expect(labels().at(-1)).toBe('Components and their parts');
  });
  it('marks the root collapsed and the last shown item current', () => {
    box.width = 320;
    render(<Breadcrumb items={TRAIL} />);
    expect(trail().hasAttribute('data-collapsed')).toBe(true);
    const items = trail().querySelectorAll('[data-slot=breadcrumb-list] > [data-slot=breadcrumb-item]');
    expect(Array.from(items).map((li) => li.hasAttribute('data-current'))).toEqual([false, false, true]);
    // The measuring copy is hidden from assistive tech and agents, and takes no focus.
    const copy = trail().querySelector<HTMLElement>('[data-slot=breadcrumb-measure]')!;
    expect(copy.getAttribute('aria-hidden')).toBe('true');
    expect(copy.hasAttribute('inert')).toBe(true);
    resize(700);
    expect(trail().hasAttribute('data-collapsed')).toBe(false);
  });
});

describe('Breadcrumb agent', () => {
  const agent = createAgent();
  const entries = () => agent.snapshot().filter((entry) => !entry.offPage);
  it('lists the shown trail, with the hidden items behind the named … menu', () => {
    box.width = 320;
    render(<Breadcrumb items={TRAIL} />);
    const root = entries().find((entry) => entry.component === 'breadcrumb')!;
    expect(root.label).toBe('Breadcrumb');
    expect(root.actions).toEqual(['activate']);
    expect(root.items).toEqual([
      { value: 'home', label: 'Home' },
      { value: 'components', label: 'Components' },
      { value: 'breadcrumb', label: 'Breadcrumb' },
    ]);
    expect(entries().some((entry) => entry.component === 'menu' && entry.label === 'More')).toBe(true);
    // Nothing from the off-screen measuring copy is offered.
    expect(entries().filter((entry) => entry.label === 'Projects')).toHaveLength(0);
    for (const entry of entries()) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  });
  it('activates a shown item, and refuses the plain-text current page', async () => {
    render(<Breadcrumb items={TRAIL} />);
    const done = await act(() => agent.act({ steps: [{ ref: 'Breadcrumb', action: 'activate', args: ['projects'] }] }));
    expect(done.ok).toBe(true);
    expect(pressed).toHaveBeenCalledWith('projects');
    const root = entries().find((entry) => entry.component === 'breadcrumb')!;
    const handle = await act(() => agent.act({ steps: [{ ref: root.ref, action: 'activate', args: ['breadcrumb'] }] }));
    expect(pressed).toHaveBeenCalledTimes(1);
    expect(handle.steps[0].result).toBe(false);
  });
});

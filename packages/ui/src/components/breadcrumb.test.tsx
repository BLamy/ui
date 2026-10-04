// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  Breadcrumb, BreadcrumbItem, fitBreadcrumbs, type BreadcrumbItemData,
} from '@/components/ui/breadcrumb';

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
  { id: 'projects', label: 'Projects', onPress: () => pressed('projects') },
  { id: 'design', label: 'Design system', href: '/design' },
  { id: 'components', label: 'Components', onPress: () => pressed('components') },
  { id: 'breadcrumb', label: 'Breadcrumb' },
];
afterEach(() => pressed.mockClear());

const press = (el: Element) => fireEvent.click(el);
const trail = () => screen.getByRole('navigation', { name: 'Breadcrumb' });
// The visible list only: the off-screen measuring copy repeats the text (aria-hidden), so `getByText` on the root would find it twice.
const list = () => trail().querySelector<HTMLElement>('[data-slot=breadcrumb-list]')!;
const labels = () => within(list()).getAllByRole('listitem').map((li) => li.textContent);

describe('Breadcrumb items', () => {
  it('renders links, the last one as the current page', () => {
    render(<Breadcrumb items={TRAIL} />);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Design system' }).getAttribute('href')).toBe('/design');
    const current = within(list()).getByText('Breadcrumb').closest('[aria-current]')!;
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.getAttribute('href')).toBeNull();
    expect(current.getAttribute('aria-disabled')).toBe('true');
  });
  it('fires onPress for a handler item and hides separators from assistive tech', () => {
    render(<Breadcrumb items={TRAIL} />);
    press(screen.getByRole('link', { name: 'Projects' }));
    expect(pressed).toHaveBeenCalledWith('projects');
    const separators = trail().querySelectorAll('[data-slot=breadcrumb-list] [data-slot=breadcrumb-separator]');
    expect(separators).toHaveLength(4); // none after the current page
    separators.forEach((s) => expect(s.getAttribute('aria-hidden')).toBe('true'));
  });
  it('lets the current page be pressable when it has a handler', () => {
    const onPress = vi.fn();
    render(<Breadcrumb items={[{ id: 'a', label: 'Docs', href: '/' }, { id: 'b', label: 'Reload', onPress }]} />);
    const current = screen.getByRole('link', { name: 'Reload' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.getAttribute('aria-disabled')).toBeNull();
    press(current);
    expect(onPress).toHaveBeenCalledTimes(1);
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
    { id: 'ui', label: 'Components', onPress: () => pressed('ui') },
    { id: 'blocks', label: 'Blocks', onPress: () => pressed('blocks') },
    { id: 'docs', label: 'Docs', href: '/docs' },
  ];
  const withSiblings = () => (
    <Breadcrumb items={[
      { id: 'home', label: 'Home', href: '/' },
      { id: 'section', label: 'Components', items: siblings, selectedId: 'ui', onPress: () => pressed('own') },
      { id: 'here', label: 'Breadcrumb' },
    ]} />
  );
  it('opens the siblings, marks the current one and fires the chosen one', () => {
    render(withSiblings());
    const trigger = screen.getByRole('button', { name: 'Components' });
    expect(trigger.getAttribute('aria-haspopup')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    press(trigger);
    const menu = screen.getByRole('menu');
    const rows = within(menu).getAllByRole('menuitemradio');
    expect(rows.map((r) => r.textContent)).toEqual(['Components', 'Blocks', 'Docs']);
    expect(rows.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(rows[2].getAttribute('href')).toBe('/docs');
    press(rows[1]);
    expect(pressed).toHaveBeenCalledWith('blocks');
    expect(pressed).not.toHaveBeenCalledWith('own');
  });
  it('opens with the keyboard', () => {
    render(withSiblings());
    const trigger = screen.getByRole('button', { name: 'Components' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyUp(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});

describe('Breadcrumb width', () => {
  it('renders the full list first and when it fits', () => {
    box.width = 600;
    render(<Breadcrumb items={TRAIL} />);
    expect(labels()).toEqual(['Home', 'Projects', 'Design system', 'Components', 'Breadcrumb']);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });
  it('collapses the middle into a … menu when the container is narrow, and restores it when it widens', () => {
    box.width = 320; // Home 44 + … 24 + Components 100 + Breadcrumb 92 + 4 × 16 = 324 does not fit; one fewer does
    render(<Breadcrumb items={TRAIL} />);
    // Home, …, Components, Breadcrumb: 44 + 24 + 100 + 92 + 3 × 16 = 308
    expect(labels()).toEqual(['Home', '', 'Components', 'Breadcrumb']);
    const more = screen.getByRole('button', { name: 'More' });

    press(more);
    const menu = screen.getByRole('menu');
    const rows = within(menu).getAllByRole('menuitem');
    expect(rows.map((r) => r.textContent)).toEqual(['Projects', 'Design system']);
    expect(rows[1].getAttribute('href')).toBe('/design');
    press(rows[0]);
    expect(pressed).toHaveBeenCalledWith('projects');

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
  it('keeps a hidden picker reachable as a submenu', () => {
    box.width = 200;
    render(
      <Breadcrumb items={[
        { id: 'home', label: 'Home', href: '/' },
        { id: 'mid', label: 'Middle section', items: [{ id: 'a', label: 'Alpha', onPress: () => pressed('alpha') }, { id: 'b', label: 'Beta' }], selectedId: 'a' },
        { id: 'here', label: 'Current page here' },
      ]} />,
    );
    press(screen.getByRole('button', { name: 'More' }));
    const row = within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Middle section' });
    expect(row.getAttribute('aria-haspopup')).toBe('menu');
  });
});

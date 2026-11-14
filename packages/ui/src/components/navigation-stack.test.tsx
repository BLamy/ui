// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLargeTitle,
  NavigationStackPage,
  NavigationStackTitle,
  NavigationStackTrailing,
  createNavigationStackController,
  type NavigationStackChangeDetails,
} from './navigation-stack';
import { useSizeClassScope } from '@/lib/container';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 30)));
const pageEls = () => [...document.querySelectorAll<HTMLElement>('[data-slot=navigation-stack-page]')];
const keys = () => pageEls().map((p) => p.dataset.value);

function Settings({ onChange }: { onChange?: (pages: string[], details: NavigationStackChangeDetails) => void }) {
  const [pages, setPages] = useState(['settings']);
  return (
    <NavigationStack pages={pages} onPagesChange={(p, d) => { onChange?.(p, d); setPages(p); }}>
      <NavigationStackPage value="settings" grouped>
        <NavigationStackBar><NavigationStackTitle>Settings</NavigationStackTitle></NavigationStackBar>
        <NavigationStackContent>
          <NavigationStackLargeTitle />
          <button type="button" data-tkrow onClick={() => setPages((p) => [...p, 'general'])}>General</button>
          <button type="button" data-tkrow>Privacy</button>
        </NavigationStackContent>
      </NavigationStackPage>
      {pages.includes('general') ? (
        <NavigationStackPage value="general">
          <NavigationStackBar>
            <NavigationStackTitle>General</NavigationStackTitle>
            <NavigationStackTrailing><button type="button">Edit</button></NavigationStackTrailing>
          </NavigationStackBar>
          <NavigationStackContent><p>About</p></NavigationStackContent>
        </NavigationStackPage>
      ) : null}
    </NavigationStack>
  );
}

it('renders the first page with its title, large title and no back button', async () => {
  render(<Settings />);
  await settle();
  expect(keys()).toEqual(['settings']);
  const page = pageEls()[0];
  expect(page.querySelector('[data-slot=navigation-stack-title]')?.textContent).toBe('Settings');
  expect(page.querySelector('[data-slot=navigation-stack-large-title]')?.textContent).toBe('Settings');
  expect(page.querySelector('[data-slot=navigation-stack-back]')).toBeNull();
});

it('pushes: the page under turns inert, focus moves into the new page, the back button names the page behind', async () => {
  render(<Settings />);
  await settle();
  const row = screen.getByRole('button', { name: 'General' });
  row.focus();
  fireEvent.click(row);
  await settle();
  expect(keys()).toEqual(['settings', 'general']);
  const [under, top] = pageEls();
  expect(under.hasAttribute('inert')).toBe(true);
  expect(under.hasAttribute('data-covered')).toBe(true);
  expect(top.contains(document.activeElement)).toBe(true);
  // The label is measured (happy-dom has no layout, so only the ruler shows it).
  const back = top.querySelector<HTMLElement>('[data-slot=navigation-stack-back]') as HTMLElement;
  expect(back.parentElement?.querySelector('[aria-hidden=true] > span')?.textContent).toBe('Settings');
  expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
});

it('pops with the back button, reports trigger-press, and hands focus back to the row that pushed', async () => {
  const onChange = vi.fn();
  render(<Settings onChange={onChange} />);
  await settle();
  const row = screen.getByRole('button', { name: 'General' });
  row.focus();
  fireEvent.click(row);
  await settle();
  fireEvent.click(pageEls()[1].querySelector('[data-slot=navigation-stack-back]') as HTMLElement);
  await settle();
  expect(onChange).toHaveBeenLastCalledWith(['settings'], expect.objectContaining({ reason: 'trigger-press' }));
  expect(keys()).toEqual(['settings']);
  expect(pageEls()[0].hasAttribute('inert')).toBe(false);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'General' }));
});

it('pops on Escape, and leaves Escape alone on the first page', async () => {
  const onChange = vi.fn();
  render(<Settings onChange={onChange} />);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'General' }));
  await settle();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await settle();
  expect(onChange).toHaveBeenLastCalledWith(['settings'], expect.objectContaining({ reason: 'escape-key' }));
  expect(keys()).toEqual(['settings']);
  onChange.mockClear();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await settle();
  expect(onChange).not.toHaveBeenCalled();
});

it('pops the innermost stack first', async () => {
  const outer = vi.fn();
  const inner = vi.fn();
  render(
    <NavigationStack defaultPages={['a', 'b']} onPagesChange={outer}>
      <NavigationStackPage value="a"><NavigationStackContent>A</NavigationStackContent></NavigationStackPage>
      <NavigationStackPage value="b">
        <NavigationStackContent>
          <NavigationStack defaultPages={['x', 'y']} onPagesChange={inner}>
            <NavigationStackPage value="x"><NavigationStackContent>X</NavigationStackContent></NavigationStackPage>
            <NavigationStackPage value="y"><NavigationStackContent><button type="button">In Y</button></NavigationStackContent></NavigationStackPage>
          </NavigationStack>
        </NavigationStackContent>
      </NavigationStackPage>
    </NavigationStack>,
  );
  await settle();
  screen.getByRole('button', { name: 'In Y' }).focus();
  fireEvent.keyDown(screen.getByRole('button', { name: 'In Y' }), { key: 'Escape' });
  await settle();
  expect(inner).toHaveBeenCalledWith(['x'], expect.objectContaining({ reason: 'escape-key' }));
  expect(outer).not.toHaveBeenCalled();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await settle();
  expect(outer).toHaveBeenCalledWith(['a'], expect.objectContaining({ reason: 'escape-key' }));
});

it('drives an uncontrolled stack from a controller', async () => {
  const controller = createNavigationStackController();
  render(
    <NavigationStack defaultPages={['root']} controller={controller}>
      <NavigationStackPage value="root"><NavigationStackBar><NavigationStackTitle>Root</NavigationStackTitle></NavigationStackBar></NavigationStackPage>
      <NavigationStackPage value="one"><NavigationStackBar><NavigationStackTitle>One</NavigationStackTitle></NavigationStackBar></NavigationStackPage>
      <NavigationStackPage value="two"><NavigationStackBar><NavigationStackTitle>Two</NavigationStackTitle></NavigationStackBar></NavigationStackPage>
    </NavigationStack>,
  );
  await settle();
  expect(keys()).toEqual(['root']);
  act(() => { controller.push('one'); });
  act(() => { controller.push('two'); });
  await settle();
  expect(controller.getPages()).toEqual(['root', 'one', 'two']);
  expect(keys()).toEqual(['root', 'one', 'two']);
  act(() => { controller.popTo('root'); });
  await settle();
  expect(keys()).toEqual(['root']);
});

it('keeps a page the children dropped on screen until it has left', async () => {
  function Dynamic() {
    const [sel, setSel] = useState<string | null>('Ada');
    return (
      <>
        <button type="button" onClick={() => setSel(null)}>Clear</button>
        <NavigationStack pages={sel ? ['list', 'detail'] : ['list']}>
          <NavigationStackPage value="list"><NavigationStackContent>List</NavigationStackContent></NavigationStackPage>
          {sel ? (
            <NavigationStackPage value="detail">
              <NavigationStackBar><NavigationStackTitle>{sel}</NavigationStackTitle></NavigationStackBar>
            </NavigationStackPage>
          ) : null}
        </NavigationStack>
      </>
    );
  }
  render(<Dynamic />);
  await settle();
  const detail = pageEls()[1];
  expect(detail.textContent).toContain('Ada');
  // happy-dom runs no transitions: give the page one to wait for.
  let finish = () => {};
  const finished = new Promise<void>((resolve) => { finish = resolve; });
  detail.getAnimations = () => [{ finished, effect: null } as unknown as Animation];
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  // Sliding out: still the same element, with what it showed.
  expect(pageEls()[1]).toBe(detail);
  expect(detail.hasAttribute('data-ending-style')).toBe(true);
  expect(detail.textContent).toContain('Ada');
  finish();
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 120)));
  expect(keys()).toEqual(['list']);
});

it('moves between rows with the arrow keys', async () => {
  render(<Settings />);
  await settle();
  const general = screen.getByRole('button', { name: 'General' });
  const privacy = screen.getByRole('button', { name: 'Privacy' });
  // happy-dom has no layout, so every row looks hidden to `offsetParent`.
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return document.body; } });
  try {
    general.focus();
    fireEvent.keyDown(general, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(privacy);
    fireEvent.keyDown(privacy, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(general);
  } finally {
    delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
  }
});

it('leaves Up and Down to a field, a select or a widget that moves with them', async () => {
  render(
    <NavigationStack defaultPages={['form']}>
      <NavigationStackPage value="form">
        <NavigationStackContent>
          <button type="button" data-tkrow>Name</button>
          <textarea aria-label="Notes" />
          <input aria-label="Count" type="number" />
          <div role="slider" aria-label="Volume" aria-valuenow={5} tabIndex={0} />
          <div aria-label="Bio" contentEditable suppressContentEditableWarning tabIndex={0} />
          <button type="button" data-tkrow>Email</button>
        </NavigationStackContent>
      </NavigationStackPage>
    </NavigationStack>,
  );
  await settle();
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return document.body; } });
  try {
    for (const name of ['Notes', 'Count', 'Volume', 'Bio']) {
      const field = screen.getByLabelText(name);
      field.focus();
      fireEvent.keyDown(field, { key: 'ArrowDown' });
      fireEvent.keyDown(field, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(field);
    }
    // A row still moves on.
    const name = screen.getByRole('button', { name: 'Name' });
    name.focus();
    fireEvent.keyDown(name, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Email' }));
  } finally {
    delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
  }
});

it('shows a back button on the first page for rootBack', async () => {
  const onClick = vi.fn();
  render(
    <NavigationStack defaultPages={['albums']} rootBack={{ title: 'Library', onClick }}>
      <NavigationStackPage value="albums"><NavigationStackBar><NavigationStackTitle>Albums</NavigationStackTitle></NavigationStackBar></NavigationStackPage>
    </NavigationStack>,
  );
  await settle();
  const back = document.querySelector<HTMLElement>('[data-slot=navigation-stack-back]') as HTMLElement;
  expect(back.parentElement?.querySelector('[aria-hidden=true] > span')?.textContent).toBe('Library');
  fireEvent.click(back);
  expect(onClick).toHaveBeenCalledTimes(1);
});

it('marks the page scrolled past its large title and hides the bar on scroll down, for the shared chrome too', async () => {
  const onBarHiddenChange = vi.fn();
  render(
    <NavigationStack defaultPages={['list']} onBarHiddenChange={onBarHiddenChange}>
      <NavigationStackPage value="list">
        <NavigationStackBar><NavigationStackTitle>Contacts</NavigationStackTitle></NavigationStackBar>
        <NavigationStackContent><NavigationStackLargeTitle /></NavigationStackContent>
      </NavigationStackPage>
    </NavigationStack>,
  );
  await settle();
  const page = pageEls()[0];
  const content = page.querySelector<HTMLElement>('[data-slot=navigation-stack-content]') as HTMLElement;
  const bar = page.querySelector<HTMLElement>('[data-slot=navigation-stack-bar]') as HTMLElement;
  act(() => { content.scrollTop = 120; content.dispatchEvent(new Event('scroll')); });
  expect(page.hasAttribute('data-scrolled')).toBe(true);
  expect(bar.hasAttribute('data-hidden')).toBe(true);
  expect(onBarHiddenChange).toHaveBeenLastCalledWith(true);
  act(() => { content.scrollTop = 60; content.dispatchEvent(new Event('scroll')); });
  expect(bar.hasAttribute('data-hidden')).toBe(false);
  expect(onBarHiddenChange).toHaveBeenLastCalledWith(false);
});

it('pops on a swipe from the leading edge, with reason swipe, and the pages settle on their own spring', async () => {
  const onChange = vi.fn();
  render(<Settings onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'General' }));
  await settle();
  const [under, top] = pageEls();
  const at = (type: string, x: number) =>
    new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, clientX: x, clientY: 200 });
  top.dispatchEvent(at('pointerdown', 4));
  document.dispatchEvent(at('pointermove', 40));
  expect(top.hasAttribute('data-swiping')).toBe(true);
  expect(under.hasAttribute('data-swiping')).toBe(true);
  document.dispatchEvent(at('pointermove', 200));
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  act(() => void document.dispatchEvent(at('pointerup', 200)));
  expect(onChange).toHaveBeenLastCalledWith(['settings'], expect.objectContaining({ reason: 'swipe', event: expect.any(PointerEvent) }));
  expect(under.hasAttribute('data-swiping')).toBe(false);
  expect(under.hasAttribute('data-swipe-settling')).toBe(true);
  await settle();
  expect(under.hasAttribute('data-swipe-settling')).toBe(false);
});

it('right to left, the swipe starts on the right edge and moves the pages the way the finger goes', async () => {
  const onChange = vi.fn();
  render(<div dir="rtl" style={{ direction: 'rtl' }}><Settings onChange={onChange} /></div>);
  fireEvent.click(screen.getByRole('button', { name: 'General' }));
  await settle();
  const [under, top] = pageEls();
  const root = document.querySelector<HTMLElement>('[data-slot=navigation-stack]')!;
  root.getBoundingClientRect = () => ({ left: 0, right: 390, top: 0, bottom: 700, width: 390, height: 700, x: 0, y: 0, toJSON: () => ({}) });
  const at = (type: string, x: number) =>
    new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, clientX: x, clientY: 200 });
  // From the left edge, which trails in this direction: nothing.
  top.dispatchEvent(at('pointerdown', 4));
  document.dispatchEvent(at('pointermove', 80));
  expect(top.hasAttribute('data-swiping')).toBe(false);
  document.dispatchEvent(at('pointerup', 80));
  // From the right edge, leftward.
  top.dispatchEvent(at('pointerdown', 386));
  document.dispatchEvent(at('pointermove', 350));
  expect(top.hasAttribute('data-swiping')).toBe(true);
  document.dispatchEvent(at('pointermove', 190));
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(Number(top.style.getPropertyValue('--stack-progress'))).toBeGreaterThan(0.4);
  // The pages move by `--stack-progress` times `--stack-dir`, which is -1 right to left: leftward, with the finger.
  for (const page of [top, under]) expect(page.className).toContain('rtl:[--stack-dir:-1]');
  expect(top.className).toContain('data-swiping:not-data-covered:[transform:translateX(calc(var(--stack-progress,0)*100%*var(--stack-dir,1)))]');
  expect(top.className).toContain('data-starting-style:[transform:translateX(calc(103%*var(--stack-dir,1)))]');
  act(() => void document.dispatchEvent(at('pointerup', 190)));
  expect(onChange).toHaveBeenLastCalledWith(['settings'], expect.objectContaining({ reason: 'swipe' }));
});

it('refuses a swipe on its first page, so it reaches what is around the stack', async () => {
  const onChange = vi.fn();
  render(<Settings onChange={onChange} />);
  await settle();
  const [first] = pageEls();
  const at = (type: string, x: number) =>
    new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true, clientX: x, clientY: 200 });
  first.dispatchEvent(at('pointerdown', 4));
  document.dispatchEvent(at('pointermove', 60));
  expect(first.hasAttribute('data-swiping')).toBe(false);
  document.dispatchEvent(at('pointerup', 60));
  expect(onChange).not.toHaveBeenCalled();
});

it('measures its own size class and provides it to what is inside, popups included', async () => {
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) { return this.dataset.slot === 'navigation-stack' ? 390 : 0; },
  });
  let seen: string | undefined;
  function Probe() {
    seen = useSizeClassScope();
    return null;
  }
  try {
    const { container } = render(
      <NavigationStack defaultPages={['home']}>
        <NavigationStackPage value="home"><NavigationStackContent><Probe /></NavigationStackContent></NavigationStackPage>
      </NavigationStack>,
    );
    await settle();
    expect(container.querySelector('[data-slot=navigation-stack]')?.getAttribute('data-size-class')).toBe('compact');
    expect(seen).toBe('compact');
  } finally {
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
  }
});

it('springs back from a swipe that heads back when let go: no pop, and the pages settle', async () => {
  const onChange = vi.fn();
  render(<Settings onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'General' }));
  await settle();
  const [under, top] = pageEls();
  const at = (type: string, x: number) =>
    new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, clientX: x, clientY: 200 });
  top.dispatchEvent(at('pointerdown', 4));
  for (const x of [100, 160, 150, 140, 130]) {
    document.dispatchEvent(at('pointermove', x));
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
  }
  expect(top.style.getPropertyValue('--stack-progress')).not.toBe('');
  act(() => void document.dispatchEvent(at('pointerup', 130)));
  expect(onChange).not.toHaveBeenCalled();
  expect(top.hasAttribute('data-swiping')).toBe(false);
  expect(top.hasAttribute('data-swipe-settling')).toBe(true);
  expect(top.style.getPropertyValue('--stack-progress')).toBe('');
  await settle();
  expect(keys()).toEqual(['settings', 'general']);
  expect(under.hasAttribute('data-covered')).toBe(true);
});

it('pops the innermost stack on the platform back (Android close watcher), with reason back', async () => {
  delete (window as unknown as Record<symbol, unknown>)[Symbol.for('bl-ui.back@1')];
  let watchers: EventTarget[] = [];
  class FakeWatcher extends EventTarget {
    constructor() { super(); watchers.push(this); }
    destroy() { watchers = watchers.filter((w) => w !== this); }
  }
  vi.stubGlobal('CloseWatcher', FakeWatcher);
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 16) Chrome/142.0 Mobile' });
  const outer = vi.fn();
  const inner = vi.fn();
  try {
    render(
      <NavigationStack defaultPages={['a', 'b']} onPagesChange={outer}>
        <NavigationStackPage value="a"><NavigationStackContent>A</NavigationStackContent></NavigationStackPage>
        <NavigationStackPage value="b">
          <NavigationStackContent>
            <NavigationStack defaultPages={['x', 'y']} onPagesChange={inner}>
              <NavigationStackPage value="x"><NavigationStackContent>X</NavigationStackContent></NavigationStackPage>
              <NavigationStackPage value="y"><NavigationStackContent>Y</NavigationStackContent></NavigationStackPage>
            </NavigationStack>
          </NavigationStackContent>
        </NavigationStackPage>
      </NavigationStack>,
    );
    await settle();
    const back = () => {
      const watcher = watchers.at(-1) as FakeWatcher;
      watcher.destroy();
      watcher.dispatchEvent(new Event('close'));
    };
    act(back);
    await settle();
    expect(inner).toHaveBeenLastCalledWith(['x'], expect.objectContaining({ reason: 'back' }));
    expect(outer).not.toHaveBeenCalled();
    act(back);
    await settle();
    expect(outer).toHaveBeenLastCalledWith(['a'], expect.objectContaining({ reason: 'back' }));
  } finally {
    cleanup();
    vi.unstubAllGlobals();
  }
});

it('a pull refreshes the page and holds the spinner for a moment at least, however fast it settles', async () => {
  const onRefresh = vi.fn(() => Promise.resolve());
  render(
    <NavigationStack defaultPages={['inbox']}>
      <NavigationStackPage value="inbox">
        <NavigationStackContent onRefresh={onRefresh}><p>Mail</p></NavigationStackContent>
      </NavigationStackPage>
    </NavigationStack>,
  );
  await settle();
  const content = document.querySelector<HTMLElement>('[data-slot=navigation-stack-content]') as HTMLElement;
  Object.defineProperty(content, 'clientHeight', { configurable: true, value: 600 });
  const touch = (type: string, points: [number, number][]) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: points.map(([clientX, clientY], identifier) => ({ identifier, clientX, clientY })) });
    return event;
  };
  const row = screen.getByText('Mail');
  act(() => {
    row.dispatchEvent(touch('touchstart', [[100, 100]]));
    row.dispatchEvent(touch('touchmove', [[100, 400]]));
    row.dispatchEvent(touch('touchend', []));
  });
  await settle();
  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(content.hasAttribute('data-pending')).toBe(true);
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 600)));
  expect(content.hasAttribute('data-pending')).toBe(true);
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 600)));
  expect(content.hasAttribute('data-pending')).toBe(false);
});

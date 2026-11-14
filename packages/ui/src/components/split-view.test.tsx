// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  SplitView,
  SplitViewContent,
  SplitViewDetail,
  SplitViewHeader,
  SplitViewItem,
  SplitViewSection,
  SplitViewSidebar,
  SplitViewSupplementary,
  SplitViewToggle,
  createSplitViewController,
  useSplitView,
  type SplitViewProps,
} from './split-view';
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackPage,
  NavigationStackTitle,
  createNavigationStackController,
  useNavigationStack,
  type NavigationStackProps,
} from './navigation-stack';
import { useSizeClassScope } from '@/lib/container';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 40)));
const escape = (el: Element = document.activeElement ?? document.body) => fireEvent.keyDown(el, { key: 'Escape' });

function Detail() {
  const s = useSplitView();
  return (
    <SplitViewDetail aria-label="Message">
      <SplitViewHeader title={s.value.supplementary ?? 'None'} />
      <SplitViewContent>{s.value.supplementary ? <p>Reading {s.value.supplementary}</p> : null}</SplitViewContent>
    </SplitViewDetail>
  );
}

function Mail(props: Partial<SplitViewProps>) {
  return (
    <SplitView aria-label="Mail" defaultValue={{ sidebar: 'inbox' }} {...props}>
      <SplitViewSidebar aria-label="Mailboxes">
        <SplitViewHeader title="Mailboxes" />
        <SplitViewContent>
          <SplitViewSection title="iCloud">
            <SplitViewItem value="inbox" title="Inbox" />
            <SplitViewItem value="sent" title="Sent" />
          </SplitViewSection>
        </SplitViewContent>
      </SplitViewSidebar>
      <SplitViewSupplementary aria-label="Inbox">
        <SplitViewHeader title="Inbox" leading={<SplitViewToggle />} />
        <SplitViewContent>
          <SplitViewItem value="m1" title="Hello" />
          <SplitViewItem value="m2" title="Review" />
        </SplitViewContent>
      </SplitViewSupplementary>
      <Detail />
    </SplitView>
  );
}

const column = (name: string) => document.querySelector<HTMLElement>(`[data-slot="split-view-${name}"]`)!;

it('tiles at regular: the toggle closes and opens the sidebar, with a reason', async () => {
  const onSidebarOpenChange = vi.fn();
  render(<Mail sizeClass="regular" onSidebarOpenChange={onSidebarOpenChange} />);
  await settle();
  expect(screen.getByRole('group', { name: 'Mail' }).getAttribute('data-size-class')).toBe('regular');
  const toggle = screen.getByRole('button', { name: 'Hide sidebar' });
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(toggle.getAttribute('aria-controls')).toBe(column('sidebar').id);
  expect(column('sidebar').hasAttribute('inert')).toBe(false);
  fireEvent.click(toggle);
  expect(onSidebarOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'trigger-press' }));
  expect(column('sidebar').hasAttribute('inert')).toBe(true);
  expect(screen.getByRole('button', { name: 'Show sidebar' }).getAttribute('aria-expanded')).toBe('false');
});

it('selects by value: items report the column, and every copy of a value draws current', async () => {
  const onValueChange = vi.fn();
  render(<Mail sizeClass="regular" onValueChange={onValueChange} />);
  await settle();
  const inbox = screen.getByRole('button', { name: 'Inbox' });
  expect(inbox.getAttribute('aria-current')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(onValueChange).toHaveBeenLastCalledWith({ sidebar: 'inbox', supplementary: 'm2' }, expect.objectContaining({ reason: 'item-press', column: 'supplementary' }));
  expect(screen.getByText('Reading m2')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Review' }).hasAttribute('data-current')).toBe(true);
});

it('each column is one tab stop: Up, Down, Home and End move between its items', async () => {
  render(<Mail sizeClass="regular" />);
  await settle();
  const inbox = screen.getByRole('button', { name: 'Inbox' });
  const sent = screen.getByRole('button', { name: 'Sent' });
  const hello = screen.getByRole('button', { name: 'Hello' });
  const review = screen.getByRole('button', { name: 'Review' });
  // The selected item holds its column's stop; a column with nothing selected starts at its first item.
  expect([inbox, sent, hello, review].map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '0', '-1']);
  inbox.focus();
  fireEvent.keyDown(inbox, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(sent);
  expect([inbox.tabIndex, sent.tabIndex]).toEqual([-1, 0]);
  fireEvent.keyDown(sent, { key: 'ArrowUp' });
  expect(document.activeElement).toBe(inbox);
  fireEvent.keyDown(inbox, { key: 'End' });
  expect(document.activeElement).toBe(sent);
  fireEvent.keyDown(sent, { key: 'Home' });
  expect(document.activeElement).toBe(inbox);
  // The arrows stay in their column: Down from the sidebar's last item goes nowhere.
  fireEvent.keyDown(inbox, { key: 'End' });
  fireEvent.keyDown(sent, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(sent);
  expect(hello.tabIndex).toBe(0);
});

it('a header follows its content: the inline title comes in once the large title scrolls under it', async () => {
  render(
    <SplitView aria-label="Notes" sizeClass="regular">
      <SplitViewSidebar aria-label="Folders">
        <SplitViewHeader title="Folders" largeTitle />
        <SplitViewContent><SplitViewItem value="a" title="All" /></SplitViewContent>
      </SplitViewSidebar>
      <SplitViewDetail aria-label="Note">
        <SplitViewHeader title="Note" showOnScroll />
        <SplitViewContent><p>Body</p></SplitViewContent>
      </SplitViewDetail>
    </SplitView>,
  );
  await settle();
  const [folders, note] = [...document.querySelectorAll<HTMLElement>('[data-slot="split-view-header"]')];
  const [list, body] = [...document.querySelectorAll<HTMLElement>('[data-slot="split-view-content"]')];
  // The large title is drawn by the content, at the top of its scroll.
  const large = list.querySelector('[data-slot="split-view-large-title"]') as HTMLElement;
  expect(large.textContent).toBe('Folders');
  expect(folders.hasAttribute('data-large-title')).toBe(true);
  expect(note.hasAttribute('data-title-hidden')).toBe(true);
  // happy-dom has no layout: the heading's bottom is where its offsets say.
  const heading = large.querySelector<HTMLElement>('[role=heading]') as HTMLElement;
  Object.defineProperty(heading, 'offsetTop', { configurable: true, value: 4 });
  Object.defineProperty(heading, 'offsetHeight', { configurable: true, value: 40 });
  act(() => { list.dispatchEvent(new Event('scroll')); });
  expect(folders.hasAttribute('data-title-hidden')).toBe(true);
  act(() => { list.scrollTop = 20; list.dispatchEvent(new Event('scroll')); });
  expect(list.hasAttribute('data-scrolled')).toBe(true);
  expect(folders.hasAttribute('data-title-hidden')).toBe(true);
  act(() => { list.scrollTop = 60; list.dispatchEvent(new Event('scroll')); });
  expect(list.hasAttribute('data-under')).toBe(true);
  expect(folders.hasAttribute('data-title-hidden')).toBe(false);
  // showOnScroll: shown once the content leaves its top, hidden (and out of the tree) back at it.
  act(() => { body.scrollTop = 12; body.dispatchEvent(new Event('scroll')); });
  expect(note.hasAttribute('data-title-hidden')).toBe(false);
  act(() => { body.scrollTop = 0; body.dispatchEvent(new Event('scroll')); });
  expect(note.hasAttribute('data-title-hidden')).toBe(true);
  expect(note.querySelector('[aria-hidden=true]')?.textContent).toBe('Note');
});

it('collapses into a stack: a pick pushes, covered columns are inert, back and Escape pop', async () => {
  const onCompactColumnChange = vi.fn();
  render(<Mail sizeClass="compact" defaultCompactColumn="sidebar" onCompactColumnChange={onCompactColumnChange} />);
  await settle();
  expect(column('sidebar').hasAttribute('data-top')).toBe(true);
  expect(column('supplementary').hasAttribute('inert')).toBe(true);
  // No sidebar toggle while collapsed: back takes over.
  expect(screen.queryByRole('button', { name: /sidebar/ })).toBeNull();

  const inbox = screen.getByRole('button', { name: 'Inbox' });
  inbox.focus();
  fireEvent.click(inbox);
  await settle();
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('supplementary', expect.objectContaining({ reason: 'item-press' }));
  expect(column('supplementary').hasAttribute('data-top')).toBe(true);
  expect(column('sidebar').hasAttribute('inert')).toBe(true);
  // Rows are navigation while collapsed: nothing draws current.
  expect(inbox.hasAttribute('data-current')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: 'Hello' }));
  await settle();
  expect(column('detail').hasAttribute('data-top')).toBe(true);
  const back = screen.getByRole('button', { name: 'Back to Inbox' });
  fireEvent.click(back);
  await settle();
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('supplementary', expect.objectContaining({ reason: 'trigger-press' }));

  escape();
  await settle();
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('sidebar', expect.objectContaining({ reason: 'escape-key' }));
  expect(column('sidebar').hasAttribute('data-top')).toBe(true);
});

it('a canceled pick changes nothing: no push, and a floating sidebar stays open', async () => {
  const onCompactColumnChange = vi.fn();
  const { unmount } = render(
    <Mail sizeClass="compact" defaultCompactColumn="supplementary" onValueChange={(_v, d) => d.cancel()} onCompactColumnChange={onCompactColumnChange} />,
  );
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Hello' }));
  await settle();
  expect(onCompactColumnChange).not.toHaveBeenCalled();
  expect(column('supplementary').hasAttribute('data-top')).toBe(true);
  expect(column('detail').hasAttribute('data-top')).toBe(false);
  unmount();

  const onSidebarOpenChange = vi.fn();
  render(
    <Mail sizeClass="medium" defaultSidebarOpen={{ medium: true }} onValueChange={(_v, d) => d.cancel()} onSidebarOpenChange={onSidebarOpenChange} />,
  );
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Sent' }));
  expect(onSidebarOpenChange).not.toHaveBeenCalled();
  expect(column('sidebar').hasAttribute('data-lifted')).toBe(true);
});

it('picking the selected item again still pushes what follows it', async () => {
  const onCompactColumnChange = vi.fn();
  render(<Mail sizeClass="compact" defaultCompactColumn="supplementary" defaultValue={{ sidebar: 'inbox', supplementary: 'm1' }} onCompactColumnChange={onCompactColumnChange} />);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Hello' }));
  await settle();
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('detail', expect.objectContaining({ reason: 'item-press' }));
});

it('floats the sidebar at medium: Escape closes it as a layer', async () => {
  const onSidebarOpenChange = vi.fn();
  render(<Mail sizeClass="medium" onSidebarOpenChange={onSidebarOpenChange} />);
  await settle();
  expect(column('sidebar').hasAttribute('inert')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }));
  await settle();
  expect(column('sidebar').hasAttribute('data-lifted')).toBe(true);
  expect(document.querySelector('[data-slot="split-view-scrim"]')!.hasAttribute('data-open')).toBe(true);
  escape(screen.getByRole('button', { name: 'Inbox' }));
  expect(onSidebarOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
});

it('picking in a floating sidebar closes it', async () => {
  const onSidebarOpenChange = vi.fn();
  render(<Mail sizeClass="medium" defaultSidebarOpen={{ medium: true }} onSidebarOpenChange={onSidebarOpenChange} />);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Sent' }));
  expect(onSidebarOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'item-press' }));
});

it('dividers are separators: arrows, Home, End and Enter resize the column', async () => {
  const onColumnWidthsChange = vi.fn();
  render(<Mail sizeClass="regular" onColumnWidthsChange={onColumnWidthsChange} />);
  await settle();
  const divider = screen.getByRole('separator', { name: 'Resize sidebar' });
  expect(divider.getAttribute('aria-valuenow')).toBe('280');
  expect(divider.getAttribute('aria-orientation')).toBe('vertical');
  fireEvent.keyDown(divider, { key: 'ArrowRight' });
  expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ sidebar: 292 }, expect.objectContaining({ reason: 'resize-key', column: 'sidebar' }));
  expect(divider.getAttribute('aria-valuenow')).toBe('292');
  fireEvent.keyDown(divider, { key: 'Home' });
  expect(divider.getAttribute('aria-valuenow')).toBe('200');
  fireEvent.keyDown(divider, { key: 'End' });
  expect(divider.getAttribute('aria-valuenow')).toBe('380');
  fireEvent.keyDown(divider, { key: 'Enter' });
  expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ sidebar: 280 }, expect.objectContaining({ reason: 'handle-press' }));
  fireEvent.keyDown(divider, { key: 'ArrowLeft', shiftKey: true });
  expect(divider.getAttribute('aria-valuenow')).toBe('232');
  // The keys go through createResize, which clamps and announces the new width.
  fireEvent.keyDown(divider, { key: 'ArrowLeft', shiftKey: true });
  expect(divider.getAttribute('aria-valuenow')).toBe('200');
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 150)));
  expect(document.querySelector('[data-ui-sdk-announcer]')?.textContent).toBe('Sidebar 200 pixels wide');
});

it('collapsed, a swipe from the leading edge pops the column stack, with reason swipe', async () => {
  const onCompactColumnChange = vi.fn();
  render(<Mail sizeClass="compact" defaultCompactColumn="supplementary" onCompactColumnChange={onCompactColumnChange} />);
  await settle();
  const top = column('supplementary');
  const at = (type: string, x: number) =>
    new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, clientX: x, clientY: 200 });
  const wait = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
  // Heading back when let go, it springs back: nothing changes.
  top.dispatchEvent(at('pointerdown', 4));
  for (const x of [100, 160, 150, 140, 130]) {
    document.dispatchEvent(at('pointermove', x));
    await wait();
  }
  expect(top.hasAttribute('data-swiping')).toBe(true);
  act(() => void document.dispatchEvent(at('pointerup', 130)));
  expect(onCompactColumnChange).not.toHaveBeenCalled();
  expect(top.hasAttribute('data-swiping')).toBe(false);
  await settle();
  top.dispatchEvent(at('pointerdown', 4));
  document.dispatchEvent(at('pointermove', 40));
  document.dispatchEvent(at('pointermove', 600));
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  act(() => void document.dispatchEvent(at('pointerup', 600)));
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('sidebar', expect.objectContaining({ reason: 'swipe' }));
  await settle();
  expect(column('sidebar').hasAttribute('data-top')).toBe(true);
});

it('closing the supplementary column hides it from the stack', async () => {
  const controller = createSplitViewController();
  render(<Mail sizeClass="compact" defaultCompactColumn="sidebar" controller={controller} />);
  await settle();
  act(() => { controller.setSupplementaryOpen(false); });
  fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));
  await settle();
  // The pick in the sidebar pushes the detail directly.
  expect(controller.getCompactColumn()).toBe('detail');
  expect(column('detail').hasAttribute('data-top')).toBe(true);
});

/* ── A column that pushes holds a NavigationStack ── */

function OpenAlbum() {
  const stack = useNavigationStack();
  return <button type="button" onClick={(event) => stack.push('tidewater', { reason: 'trigger-press', event: event.nativeEvent })}>Open album</button>;
}

/** A page `renderPage` draws for a key no child is for. */
function Album({ page }: { page: string }) {
  return (
    <NavigationStackPage value={page}>
      <NavigationStackBar><NavigationStackTitle>{page}</NavigationStackTitle></NavigationStackBar>
      <NavigationStackContent><p>Tracks of {page}</p></NavigationStackContent>
    </NavigationStackPage>
  );
}

function Albums(props: Partial<NavigationStackProps>) {
  return (
    <NavigationStack defaultPages={['albums']} renderPage={(page) => <Album page={page} />} {...props}>
      <NavigationStackPage value="albums">
        <NavigationStackBar><NavigationStackTitle>Albums</NavigationStackTitle></NavigationStackBar>
        <NavigationStackContent><OpenAlbum /></NavigationStackContent>
      </NavigationStackPage>
    </NavigationStack>
  );
}

function Library({ stack, ...props }: Partial<SplitViewProps> & { stack?: Partial<NavigationStackProps> }) {
  return (
    <SplitView aria-label="Library" defaultValue={{ sidebar: 'recent' }} {...props}>
      <SplitViewSidebar aria-label="Library">
        <SplitViewHeader title="Library" />
        <SplitViewContent>
          <SplitViewItem value="recent" title="Recent" />
          <SplitViewItem value="songs" title="Songs" />
        </SplitViewContent>
      </SplitViewSidebar>
      <SplitViewDetail aria-label="Albums"><Albums {...stack} /></SplitViewDetail>
    </SplitView>
  );
}

const stackPages = () => [...document.querySelectorAll<HTMLElement>('[data-slot=navigation-stack-page]')].map((p) => p.dataset.value);

it('a NavigationStack in a column pops first, then the column stack', async () => {
  const onCompactColumnChange = vi.fn();
  const onPagesChange = vi.fn();
  render(<Library sizeClass="compact" defaultCompactColumn="detail" onCompactColumnChange={onCompactColumnChange} stack={{ onPagesChange }} />);
  await settle();
  const open = screen.getByRole('button', { name: 'Open album' });
  open.focus();
  fireEvent.click(open);
  await settle();
  expect(onPagesChange).toHaveBeenLastCalledWith(['albums', 'tidewater'], expect.objectContaining({ reason: 'trigger-press' }));
  expect(screen.getByText('Tracks of tidewater')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Back to Albums' })).toBeTruthy();

  escape();
  await settle();
  expect(onPagesChange).toHaveBeenLastCalledWith(['albums'], expect.objectContaining({ reason: 'escape-key' }));
  expect(onCompactColumnChange).not.toHaveBeenCalled();

  escape();
  await settle();
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('sidebar', expect.objectContaining({ reason: 'escape-key' }));
});

it('collapsed, the first page of a column\'s stack goes back to the column before, named by its title', async () => {
  const onCompactColumnChange = vi.fn();
  render(<Library sizeClass="compact" defaultCompactColumn="detail" onCompactColumnChange={onCompactColumnChange} />);
  await settle();
  const back = screen.getByRole('button', { name: 'Back to Library' });
  expect(back.getAttribute('data-slot')).toBe('navigation-stack-back');
  fireEvent.click(back);
  await settle();
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('sidebar', expect.objectContaining({ reason: 'trigger-press' }));
  expect(column('sidebar').hasAttribute('data-top')).toBe(true);
});

it('a column after a stack labels its back button with the stack\'s first page', async () => {
  render(
    <SplitView aria-label="Library" sizeClass="compact" defaultCompactColumn="detail">
      <SplitViewSidebar aria-label="Library"><Albums /></SplitViewSidebar>
      <SplitViewDetail aria-label="Album"><SplitViewHeader title="Tidewater" /></SplitViewDetail>
    </SplitView>,
  );
  await settle();
  expect(screen.getByRole('button', { name: 'Back to Albums' }).getAttribute('data-slot')).toBe('split-view-back');
});

it('tiled, the stack\'s first page has no back button and Escape there passes through', async () => {
  const onCompactColumnChange = vi.fn();
  render(<Library sizeClass="regular" onCompactColumnChange={onCompactColumnChange} />);
  await settle();
  expect(document.querySelector('[data-slot=navigation-stack-back]')).toBeNull();
  const open = screen.getByRole('button', { name: 'Open album' });
  open.focus();
  const behind = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
  window.addEventListener('keydown', behind);
  escape();
  window.removeEventListener('keydown', behind);
  expect(behind).toHaveReturnedWith(false);
  expect(onCompactColumnChange).not.toHaveBeenCalled();
});

it('collapsed, a swipe from the leading edge pops the column\'s stack before the columns', async () => {
  const onCompactColumnChange = vi.fn();
  const onPagesChange = vi.fn();
  render(<Library sizeClass="compact" defaultCompactColumn="detail" onCompactColumnChange={onCompactColumnChange}
    stack={{ defaultPages: ['albums', 'tidewater'], onPagesChange }} />);
  await settle();
  const at = (type: string, x: number) =>
    new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, clientX: x, clientY: 200 });
  const swipe = async (el: HTMLElement) => {
    el.dispatchEvent(at('pointerdown', 4));
    document.dispatchEvent(at('pointermove', 40));
    document.dispatchEvent(at('pointermove', 600));
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    act(() => void document.dispatchEvent(at('pointerup', 600)));
    await settle();
  };
  await swipe(screen.getByText('Tracks of tidewater'));
  expect(onPagesChange).toHaveBeenLastCalledWith(['albums'], expect.objectContaining({ reason: 'swipe' }));
  expect(onCompactColumnChange).not.toHaveBeenCalled();
  await swipe(screen.getByRole('button', { name: 'Open album' }));
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('sidebar', expect.objectContaining({ reason: 'swipe' }));
});

it('resetKey pops the stack to its first page when the sidebar picks something else', async () => {
  function Reset() {
    const [value, setValue] = useState<SplitViewProps['value']>({ sidebar: 'recent' });
    return <Library sizeClass="regular" defaultValue={undefined} value={value} onValueChange={setValue} stack={{ defaultPages: ['albums', 'tidewater'], resetKey: value?.sidebar }} />;
  }
  render(<Reset />);
  await settle();
  expect(stackPages()).toContain('tidewater');
  fireEvent.click(screen.getByRole('button', { name: 'Songs' }));
  await settle();
  await settle();
  expect(stackPages()).toEqual(['albums']);
});

it('the column\'s stack keeps its pages through size-class changes: the handoff between tiled and collapsed', async () => {
  // The column on top while collapsed is tracked at every size: the detail, where the reader is.
  const { rerender } = render(<Library sizeClass="regular" defaultCompactColumn="detail" stack={{ defaultPages: ['albums', 'tidewater'] }} />);
  await settle();
  const page = screen.getByText('Tracks of tidewater').closest('[data-slot=navigation-stack-page]');
  expect(screen.getByRole('button', { name: 'Back to Albums' })).toBeTruthy();
  rerender(<Library sizeClass="compact" defaultCompactColumn="detail" stack={{ defaultPages: ['albums', 'tidewater'] }} />);
  await settle();
  // The same page, still on top, now in the column on top of the compact stack.
  expect(screen.getByText('Tracks of tidewater').closest('[data-slot=navigation-stack-page]')).toBe(page);
  expect(column('detail').hasAttribute('data-top')).toBe(true);
  escape();
  await settle();
  // At its first page, the stack now offers the way back to the sidebar.
  expect(screen.getByRole('button', { name: 'Back to Library' })).toBeTruthy();
  rerender(<Library sizeClass="regular" defaultCompactColumn="detail" stack={{ defaultPages: ['albums', 'tidewater'] }} />);
  await settle();
  expect(document.querySelector('[data-slot=navigation-stack-back]')).toBeNull();
  expect(column('sidebar').hasAttribute('inert')).toBe(false);
});

/** A transition that runs for 100 ms on the elements `match` picks, as a browser reports a running `translate`. */
function transitions(match: (el: Element) => boolean) {
  const original = Element.prototype.getAnimations;
  Element.prototype.getAnimations = function (this: Element) {
    if (!match(this)) return [];
    return [{ transitionProperty: 'translate', finished: new Promise((resolve) => setTimeout(resolve, 100)), effect: null }] as unknown as Animation[];
  };
  return () => { Element.prototype.getAnimations = original; };
}

it('a column popped off the compact stack stays inert while and after its transition runs', async () => {
  const restore = transitions((el) => (el as HTMLElement).dataset?.slot === 'split-view-detail');
  try {
    render(<Mail sizeClass="compact" defaultCompactColumn="supplementary" />);
    await settle();
    expect(column('detail').inert).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hello' }));
    await settle();
    expect(column('detail').inert).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Inbox' }));
    expect(column('detail').hasAttribute('data-ending-style')).toBe(false);
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 300)));
    // Off-screen, so out of the tab order and the accessibility tree: nothing put `inert` back to false.
    expect(column('detail').inert).toBe(true);
    expect(column('detail').hasAttribute('data-top')).toBe(false);
    expect(column('supplementary').hasAttribute('data-top')).toBe(true);
  } finally {
    restore();
  }
});

it('right to left, the compact columns move by --stack-dir and the swipe starts on the right edge', async () => {
  const onCompactColumnChange = vi.fn();
  render(<div dir="rtl" style={{ direction: 'rtl' }}><Mail sizeClass="compact" defaultCompactColumn="supplementary" onCompactColumnChange={onCompactColumnChange} /></div>);
  await settle();
  const root = document.querySelector<HTMLElement>('[data-slot="split-view"]')!;
  root.getBoundingClientRect = () => ({ left: 0, right: 390, top: 0, bottom: 700, width: 390, height: 700, x: 0, y: 0, toJSON: () => ({}) });
  const top = column('supplementary');
  expect(top.className).toContain('rtl:[--stack-dir:-1]');
  expect(top.className).toContain('translate-x-[calc(var(--column-translate)_*_var(--stack-dir,1))]');
  expect(top.className).toContain('data-swiping:data-top:translate-x-[calc(var(--stack-progress)_*_100%_*_var(--stack-dir,1))]');
  const at = (type: string, x: number) =>
    new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, clientX: x, clientY: 200 });
  top.dispatchEvent(at('pointerdown', 386));
  document.dispatchEvent(at('pointermove', 350));
  document.dispatchEvent(at('pointermove', 100));
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(top.hasAttribute('data-swiping')).toBe(true);
  act(() => void document.dispatchEvent(at('pointerup', 100)));
  expect(onCompactColumnChange).toHaveBeenLastCalledWith('sidebar', expect.objectContaining({ reason: 'swipe' }));
});

function Controlled({ initial, onPagesChange }: { initial: string[]; onPagesChange?: (pages: string[], details: unknown) => void }) {
  const [pages, setPages] = useState(initial);
  return <Library sizeClass="compact" defaultCompactColumn="detail" stack={{ defaultPages: undefined, pages, onPagesChange: (next, details) => { onPagesChange?.(next, details); setPages(next); } }} />;
}

it('controlled pages: a deep link renders its pages from renderPage, and a pop is heard and fed back', async () => {
  const onPagesChange = vi.fn();
  render(<Controlled initial={['albums', 'tidewater', 'live']} onPagesChange={onPagesChange} />);
  await settle();
  expect(screen.getByText('Tracks of live')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Back to tidewater' }).length).toBeGreaterThan(0);
  escape();
  await settle();
  expect(onPagesChange).toHaveBeenLastCalledWith(['albums', 'tidewater'], expect.anything());
  await settle();
  expect(screen.queryByText('Tracks of live')).toBeNull();
  // A key pushed from inside still works with controlled pages.
  escape();
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Open album' }));
  await settle();
  expect(onPagesChange).toHaveBeenLastCalledWith(['albums', 'tidewater'], expect.objectContaining({ reason: 'trigger-press' }));
  expect(screen.getByText('Tracks of tidewater')).toBeTruthy();
});

it('a controlled pop keeps a renderPage page on screen through its exit', async () => {
  render(<Controlled initial={['albums', 'live']} />);
  await settle();
  const page = screen.getByText('Tracks of live').closest<HTMLElement>('[data-slot="navigation-stack-page"]')!;
  // Its exit runs until `finish`, as a CSS transition would (with a computed duration, so UI SDK's safety
  // timeout waits for it).
  let finish = () => {};
  const finished = new Promise<void>((resolve) => (finish = resolve));
  page.getAnimations = () => [{ transitionProperty: 'transform', finished, effect: null } as unknown as Animation];
  const style = document.head.appendChild(document.createElement('style'));
  style.textContent = '[data-slot="navigation-stack-page"] { transition-duration: 10s; transition-delay: 0s; animation-duration: 0s; animation-delay: 0s; animation-iteration-count: 1 }';
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Back to Albums' }));
    await settle();
    expect(page.isConnected).toBe(true);
    expect(page.hasAttribute('data-ending-style')).toBe(true);
    await act(async () => {
      finish();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(page.isConnected).toBe(false);
  } finally {
    style.remove();
  }
});

it('a controller drives the column\'s stack from outside, and a canceled push keeps the pages', async () => {
  const controller = createNavigationStackController();
  let cancel = false;
  render(<Library sizeClass="compact" defaultCompactColumn="detail" stack={{ controller, onPagesChange: (_pages, details) => { if (cancel) details.cancel(); } }} />);
  await settle();
  act(() => void controller.push('live'));
  await settle();
  expect(controller.getPages()).toEqual(['albums', 'live']);
  expect(screen.getByText('Tracks of live')).toBeTruthy();
  act(() => void controller.popTo('albums'));
  await settle();
  expect(controller.getPages()).toEqual(['albums']);
  cancel = true;
  fireEvent.click(screen.getByRole('button', { name: 'Open album' }));
  await settle();
  expect(controller.getPages()).toEqual(['albums']);
  expect(screen.queryByText('Tracks of tidewater')).toBeNull();
});

it('a disabled item is skipped by the arrow keys and does not select', async () => {
  const onValueChange = vi.fn();
  render(
    <SplitView aria-label="Lists" sizeClass="regular" onValueChange={onValueChange}>
      <SplitViewSidebar aria-label="Lists">
        <SplitViewItem value="a" title="Work" />
        <SplitViewItem value="b" title="Archived" disabled />
        <SplitViewItem value="c" title="Travel" />
      </SplitViewSidebar>
      <SplitViewDetail aria-label="List" />
    </SplitView>,
  );
  await settle();
  const [work, archived, travel] = ['Work', 'Archived', 'Travel'].map((name) => screen.getByRole('button', { name }));
  expect(archived.hasAttribute('disabled')).toBe(true);
  fireEvent.click(archived);
  expect(onValueChange).not.toHaveBeenCalled();
  work.focus();
  fireEvent.keyDown(work, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(travel);
});

it('columns take rest props and a className of their own, merged last', async () => {
  render(
    <SplitView aria-label="Mail" sizeClass="regular">
      <SplitViewSidebar aria-label="Boxes" data-testid="boxes" className="bg-muted" />
      <SplitViewDetail aria-label="Message" className={(s) => (s.top ? 'is-top' : 'not-top')} />
    </SplitView>,
  );
  await settle();
  const sidebar = column('sidebar');
  expect(sidebar.getAttribute('data-testid')).toBe('boxes');
  expect(sidebar.className).toContain('bg-muted');
  expect(sidebar.className).not.toContain('bg-sidebar');
  expect(column('detail').className).toContain('not-top');
});

it('a collapsible section folds through UI SDK Collapsible', async () => {
  const onOpenChange = vi.fn();
  render(
    <SplitView aria-label="Lists" sizeClass="regular">
      <SplitViewSidebar aria-label="Lists">
        <SplitViewSection title="My Lists" collapsible onOpenChange={onOpenChange}>
          <SplitViewItem value="work" title="Work" />
        </SplitViewSection>
      </SplitViewSidebar>
      <SplitViewDetail aria-label="List" />
    </SplitView>,
  );
  await settle();
  const trigger = screen.getByRole('button', { name: 'My Lists' });
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('group', { name: 'My Lists' })).toBeTruthy();
  fireEvent.click(trigger);
  expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'trigger-press' }));
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('an item with a preview is a hover card trigger that still selects', async () => {
  const onValueChange = vi.fn();
  render(
    <SplitView aria-label="Lists" sizeClass="regular" onValueChange={onValueChange}>
      <SplitViewSidebar aria-label="Lists">
        <SplitViewItem value="work" title="Work" preview={<p>Motion review</p>} />
      </SplitViewSidebar>
      <SplitViewDetail aria-label="List" />
    </SplitView>,
  );
  await settle();
  const item = screen.getByRole('button', { name: 'Work' });
  expect(item.getAttribute('data-slot')).toBe('split-view-item');
  fireEvent.click(item);
  expect(onValueChange).toHaveBeenLastCalledWith({ sidebar: 'work' }, expect.objectContaining({ reason: 'item-press' }));
});

it('keeps every column through size-class changes, and resets the sidebar with a reason', async () => {
  const onSidebarOpenChange = vi.fn();
  const onSizeClassChange = vi.fn();
  const { rerender } = render(<Mail sizeClass="regular" defaultValue={{ sidebar: 'inbox', supplementary: 'm1' }}
    onSidebarOpenChange={onSidebarOpenChange} onSizeClassChange={onSizeClassChange} />);
  await settle();
  await settle();
  const detail = column('detail');
  rerender(<Mail sizeClass="medium" defaultValue={{ sidebar: 'inbox', supplementary: 'm1' }}
    onSidebarOpenChange={onSidebarOpenChange} onSizeClassChange={onSizeClassChange} />);
  expect(onSizeClassChange).toHaveBeenLastCalledWith('medium');
  expect(onSidebarOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'content-resize' }));
  rerender(<Mail sizeClass="compact" defaultValue={{ sidebar: 'inbox', supplementary: 'm1' }}
    onSidebarOpenChange={onSidebarOpenChange} onSizeClassChange={onSizeClassChange} />);
  await settle();
  // The same element, now the top of the stack where the reader was.
  expect(column('detail')).toBe(detail);
  expect(screen.getByText('Reading m1')).toBeTruthy();
  expect(column('supplementary').hasAttribute('data-top')).toBe(true);
  rerender(<Mail sizeClass="regular" defaultValue={{ sidebar: 'inbox', supplementary: 'm1' }}
    onSidebarOpenChange={onSidebarOpenChange} onSizeClassChange={onSizeClassChange} />);
  await settle();
  expect(column('detail')).toBe(detail);
  expect(column('supplementary').hasAttribute('inert')).toBe(false);
  expect(onSidebarOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'content-resize' }));
});

it('moves focus into a pushed column and back to the item that pushed it', async () => {
  render(<Mail sizeClass="compact" defaultCompactColumn="sidebar" />);
  await settle();
  const inbox = screen.getByRole('button', { name: 'Inbox' });
  inbox.focus();
  fireEvent.click(inbox);
  await settle();
  expect(column('supplementary').contains(document.activeElement)).toBe(true);
  escape();
  await settle();
  expect(document.activeElement).toBe(inbox);
});

it('tiled, the columns are no stack: Escape passes through, nothing leaves, and focus stays where it is', async () => {
  const onCompactColumnChange = vi.fn();
  render(<Mail sizeClass="regular" defaultCompactColumn="detail" onCompactColumnChange={onCompactColumnChange} />);
  await settle();
  const hello = screen.getByRole('button', { name: 'Hello' });
  hello.focus();
  const behind = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
  window.addEventListener('keydown', behind);
  escape();
  window.removeEventListener('keydown', behind);
  expect(behind).toHaveReturnedWith(false);
  expect(onCompactColumnChange).not.toHaveBeenCalled();
  for (const name of ['sidebar', 'supplementary', 'detail']) {
    expect(column(name).hasAttribute('data-ending-style')).toBe(false);
    expect(column(name).hasAttribute('data-covered')).toBe(false);
  }
  expect(document.activeElement).toBe(hello);
});

it('provides its size class to what is inside, popups included', async () => {
  let seen: string | undefined;
  function Probe() {
    seen = useSizeClassScope();
    return null;
  }
  render(
    <SplitView aria-label="Mail" sizeClass="compact">
      <SplitViewDetail aria-label="Message"><Probe /></SplitViewDetail>
    </SplitView>,
  );
  await settle();
  expect(seen).toBe('compact');
});

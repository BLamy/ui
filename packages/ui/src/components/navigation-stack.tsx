'use client';
import {
  Children, createContext, Fragment, isValidElement, use, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type ComponentProps, type CSSProperties, type ReactElement, type ReactNode,
} from 'react';
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { chromeStore, BLSafeCtx, BLStickyCtx } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import { SizeClassProvider } from '@/lib/container';
import { barMaterial, barSurface, BARH } from '@/lib/primitives';
import { StackParentContext, scrollToTop } from '@/lib/stack-parent';
import {
  BackLabel, backName, barBackButton, barTitle, barTitleFade, barTitleHidden, largeTitleText, useBackFit,
} from '@/lib/nav-bar';
import type { SizeClass } from '@/lib/size-class';
import type { Stack, StackExit } from '@/lib/stack';
import {
  createNavigationStackController,
  navigationStack,
  type NavigationStackChangeDetails,
  type NavigationStackChangeOptions,
  type NavigationStackController,
  type NavigationStackOptions,
  type NavigationStackPageState,
  type NavigationStackReason,
  type NavigationStackSwipe,
} from '@/lib/navigation-stack-primitive';
import { backLabel, createTitleFlight, pushedTitle, shownTitle, type TitleParts } from '@/lib/title-flight';
import { Spinner } from '@/components/ui/spinner';

export { createNavigationStackController };
export type {
  NavigationStackChangeDetails, NavigationStackChangeOptions, NavigationStackController, NavigationStackPageState,
  NavigationStackReason,
};

/* ══ NavigationStack — iOS's navigation controller ══
   A stack of pages in its own box: push slides a page in from the trailing edge over the one under it, which
   parallaxes back 30% under a 10% shade; pop reverses it. The back button names the page behind (the previous title
   when it fits beside the centered title, "Back" when only a sliver is left, else the chevron alone) and its title
   flies into it on a push, and back on a pop. Escape, the platform back and a swipe from the leading edge pop the
   innermost stack first; focus goes into a pushed page and back to what pushed it. Large titles collapse into the
   bar on scroll, the bar rides away as the content scrolls down (with any `Tabs` bar, through the shared chrome
   state), and a page can pull to refresh. Built on the `navigationStack` primitive (lib/navigation-stack-primitive.ts).

   <NavigationStack pages={pages} onPagesChange={setPages}>
     <NavigationStackPage value="list">
       <NavigationStackBar><NavigationStackTitle>Contacts</NavigationStackTitle></NavigationStackBar>
       <NavigationStackContent><NavigationStackLargeTitle /> …rows</NavigationStackContent>
     </NavigationStackPage>
     {sel && <NavigationStackPage value="detail">…</NavigationStackPage>}
   </NavigationStack>

   Pages are the stack's direct children (or in fragments and arrays), each with a `value`, and `renderPage(key)`
   draws the keys in `pages` no child is for (a deep link, a key pushed from a row). A page dropped while it pops is
   kept on screen until it has slid out.

   In a SplitView column the column is the stack's parent (lib/stack-parent): collapsed, the first page gets the back
   button to the column before; Escape and the swipe pop this stack's pages before the columns move; pressing the
   selected tab of a sidebar that is a tab bar pops to the first page (or scrolls it to the top). `resetKey`
   pops to the first page when it changes (the sidebar selection the stack belongs to). ══ */

const {
  Page, Bar, Title, Back, Leading, Trailing, Content, LargeTitle, Subheader, RefreshIndicator, Shade,
} = createParts(navigationStack, {
  page: 'section', bar: 'div', title: 'div', back: 'button', leading: 'div', trailing: 'div',
  content: 'div', 'large-title': 'div', subheader: 'div', 'refresh-indicator': 'div', shade: 'div',
});

type ClassProp<S> = string | ((state: S) => string | undefined) | undefined;
type StyleProp<S> = CSSProperties | ((state: S) => CSSProperties | undefined) | undefined;
const classOf = <S,>(c: ClassProp<S>, s: S) => (typeof c === 'function' ? c(s) : c);
const styleOf = <S,>(c: StyleProp<S>, s: S) => (typeof c === 'function' ? c(s) : c);

/* ── Titles: each page's NavigationStackTitle publishes what it shows, for the large title, the back label of the
   page above it and the parent's (a SplitView column's) back label. ── */
function createTitles() {
  const map = new Map<string, ReactNode>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: (key: string | null | undefined) => (key == null ? undefined : map.get(key)),
    set(key: string, title: ReactNode) {
      if (map.get(key) === title && map.has(key)) return;
      map.set(key, title);
      emit();
    },
    delete(key: string, title: ReactNode) {
      if (map.get(key) !== title) return;
      map.delete(key);
      emit();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}
type Titles = ReturnType<typeof createTitles>;

/** A back button on the first page (there is nothing of the stack's own to pop): its label and action. */
export interface NavigationStackRootBack {
  title?: ReactNode;
  onClick: () => void;
}

interface StackContext {
  api: NavigationStackController;
  titles: Titles;
  rootBack: NavigationStackRootBack | null;
  bottomInset: number;
}
const StackCtx = createContext<StackContext | null>(null);
const PageCtx = createContext<string | null>(null);
const BarCtx = createContext(false);

function useStack(part: string): StackContext {
  const s = use(StackCtx);
  if (!s) throw new Error(`${part} must be inside a NavigationStack.`);
  return s;
}
function usePageKey(part: string): string {
  const k = use(PageCtx);
  if (k == null) throw new Error(`${part} must be inside a NavigationStackPage.`);
  return k;
}
function useTitle(titles: Titles, key: string | null | undefined): ReactNode {
  return useSyncExternalStore(titles.subscribe, () => titles.get(key), () => titles.get(key));
}

/** The stack around: its `push`, `pop`, `popTo`, `replace`, `refresh` and `getPages`, for a row that pushes or a
 *  button that pops. Throws outside a NavigationStack (as `useSplitView` does outside a SplitView). */
export function useNavigationStack(): NavigationStackController {
  return useStack('useNavigationStack').api;
}

/* ── Root ── */

type SwipeSource = { onSwipe: (fn: (swipe: NavigationStackSwipe) => void) => () => void };

type RootState = { pages: string[]; exiting: StackExit[]; sizeClass: SizeClass | undefined };

export interface NavigationStackProps
  extends Omit<ComponentProps<'div'>, 'className' | 'style' | 'children'>,
    Omit<NavigationStackOptions, 'onRootBack'> {
  className?: string | ((state: RootState) => string | undefined);
  style?: CSSProperties | ((state: RootState) => CSSProperties | undefined);
  children?: ReactNode;
  /** Draws a page for a key in `pages` that no child is for: a deep link, a stack restored after a reload, a key
   *  pushed from a row (`useNavigationStack().push(key)`). Return a `NavigationStackPage` with that `value`. */
  renderPage?: (page: string) => ReactNode;
  /** Changing it pops every page above the first at once (the sidebar selection the stack belongs to). */
  resetKey?: unknown;
  /** A back button on the first page, for a stack that sits under something else to go back to. Inside a
   *  collapsed SplitView column it defaults to the previous column, labelled with its title; `false` turns that
   *  off. */
  rootBack?: NavigationStackRootBack | false;
  /** Safe-area top for this stack, px. Usually inherited from BLProvider instead. */
  safeTop?: number;
  /** Extra room kept under every page's content (px), unless a page's content sets its own: a mini player, a
   *  toolbar of your own. A Tabs `bar` (or a SplitView sidebar that became a tab bar) around the stack is counted by
   *  itself (`--tabs-bar-h`), safe area included, so it needs none. Default 0. */
  bottomInset?: number;
}

/** The stack root. `pages` / `defaultPages` / `onPagesChange(pages, details)` hold its pages by key, bottom to top
 *  (`details.reason`: `trigger-press`, `escape-key`, `back`, `swipe` or `imperative`); `controller` drives it. With
 *  neither `pages` nor `defaultPages` it starts on its first page child. */
export function NavigationStack({
  pages, defaultPages, onPagesChange, controller, onBarHiddenChange, renderPage, resetKey,
  rootBack, safeTop, bottomInset = 0, className, children, ...props
}: NavigationStackProps) {
  const [titles] = useState(createTitles);
  const inheritedSafeTop = use(BLSafeCtx);
  const safe = safeTop ?? inheritedSafeTop;
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const rootBackRef = useRef<NavigationStackRootBack | null>(null);
  const onRootBack = useCallback(() => rootBackRef.current?.onClick(), []);
  const onHidden = useCallback((hidden: boolean) => {
    chromeStore.set(hidden);
    onBarHiddenChange?.(hidden);
  }, [onBarHiddenChange]);
  const userRef = props.ref;
  const setRef = useCallback((el: HTMLDivElement | null) => {
    setRootEl(el);
    if (typeof userRef === 'function') userRef(el);
    else if (userRef) userRef.current = el;
  }, [userRef]);
  // Uncontrolled with no `defaultPages`, the stack starts on its first page child.
  const [firstPage] = useState(() => (pages === undefined && defaultPages === undefined
    ? flatten(children).map(valueOf).find((v): v is string => v !== null) : undefined));
  const handle = usePrimitive(navigationStack, {
    pages, defaultPages: defaultPages ?? (firstPage === undefined ? undefined : [firstPage]), controller, onPagesChange, onRootBack, onBarHiddenChange: onHidden,
  });
  const api = handle.api as unknown as NavigationStackController;
  const { stack, internal } = handle.api as unknown as { stack: Stack; internal: SwipeSource };

  // A new resetKey pops to the first page (compared with the last one seen, so a remount pops nothing).
  const lastReset = useRef(resetKey);
  useLayoutEffect(() => {
    if (Object.is(lastReset.current, resetKey)) return;
    lastReset.current = resetKey;
    const now = api.getPages();
    if (now.length > 1) api.popTo(now[0]);
  }, [resetKey, api]);

  const root = usePart(handle, 'root', {}, {
    ...props,
    ref: setRef,
    className: (s: RootState) => cn('absolute inset-0 touch-pan-y overflow-hidden', classOf(className, s)),
    children: (state: RootState) => (
      <SizeClassProvider value={state.sizeClass}>
        <Pages pages={state.pages} exiting={state.exiting} present={(page) => stack.present(state, page)} api={api} titles={titles} rootEl={rootEl}
          rootBackProp={rootBack} rootBackRef={rootBackRef} swipes={internal} bottomInset={bottomInset} renderPage={renderPage}>
          {children}
        </Pages>
      </SizeClassProvider>
    ),
  }, 'div');
  return <BLSafeCtx.Provider value={safe}>{root}</BLSafeCtx.Provider>;
}

/** The header elements of one of this stack's pages (not those of a stack nested inside it). */
function own(page: HTMLElement, slot: string): HTMLElement | null {
  for (const el of page.querySelectorAll<HTMLElement>(`[data-slot=navigation-stack-${slot}]`)) {
    if (el.closest('[data-slot=navigation-stack-page]') === page) return el;
  }
  return null;
}
function titleParts(page: HTMLElement | null | undefined): TitleParts | undefined {
  if (!page) return undefined;
  return {
    el: page,
    large: (own(page, 'large-title')?.firstElementChild?.firstElementChild as HTMLElement | null) ?? null,
    inline: own(page, 'title'),
    back: own(page, 'back')?.querySelector<HTMLElement>('[data-mode]') ?? null,
  };
}

/** Flattens fragments and arrays: the stack's pages are the elements with a string `value`. */
function flatten(children: ReactNode, out: ReactNode[] = []): ReactNode[] {
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.type === Fragment) flatten((c.props as { children?: ReactNode }).children, out);
    else out.push(c);
  });
  return out;
}
const valueOf = (c: ReactNode) => (isValidElement(c) && typeof (c.props as { value?: unknown }).value === 'string'
  ? (c.props as { value: string }).value : null);

interface PagesProps {
  api: NavigationStackController;
  pages: string[];
  exiting: StackExit[];
  /** Whether a page renders: in the stack, or leaving (`createStack`'s `present`). */
  present: (page: string) => boolean;
  titles: Titles;
  rootEl: HTMLDivElement | null;
  rootBackProp: NavigationStackRootBack | false | undefined;
  rootBackRef: { current: NavigationStackRootBack | null };
  /** The stack's edge swipe, for the title flight to follow. */
  swipes: SwipeSource;
  bottomInset: number;
  renderPage: ((page: string) => ReactNode) | undefined;
  children: ReactNode;
}

function Pages({ api, pages, exiting, present, titles, rootEl, rootBackProp, rootBackRef, swipes, bottomInset, renderPage, children }: PagesProps) {
  // The container around (a SplitView column): the first page names it, and its way back is the first page's.
  const parent = use(StackParentContext);
  const rootTitle = useTitle(titles, pages[0]);
  const rootName = typeof rootTitle === 'string' ? rootTitle : undefined;
  const nameParent = parent?.setTitle;
  useLayoutEffect(() => {
    if (nameParent && rootName !== undefined) nameParent(rootName);
  }, [nameParent, rootName]);
  const rootBack = rootBackProp === false ? null : rootBackProp ?? (parent?.back ? { title: parent.back.title, onClick: parent.back.onClick } : null);
  rootBackRef.current = rootBack;
  // The container's place picked again (a SplitView tab bar's selected tab): back to the first page, or its top.
  const onReselect = parent?.onReselect;
  useLayoutEffect(() => onReselect?.(() => {
    const now = api.getPages();
    if (now.length > 1) { api.popTo(now[0], { reason: 'trigger-press' }); return; }
    const page = rootEl ? [...rootEl.children].find((e): e is HTMLElement => e instanceof HTMLElement && e.dataset.value === now[0]) : undefined;
    scrollToTop(page ? own(page, 'content') : null);
  }), [onReselect, api, rootEl]);

  // The stack says which pages render: those in it and those leaving. A page the children drop while it is still
  // there stays, where it was, until it has left.
  const kept = useRef(new Map<string, ReactElement>());
  const order = useRef<string[]>([]);
  const list = flatten(children);
  const shown = new Set<string>();
  const out: { key: string; node: ReactNode }[] = [];
  list.forEach((c, i) => {
    const v = valueOf(c);
    if (v === null) { out.push({ key: 'c:' + i, node: c }); return; }
    kept.current.set(v, c as ReactElement);
    shown.add(v);
    if (present(v)) out.push({ key: 'p:' + v, node: c });
  });
  // The keys no child is for, from `renderPage`, in stack order.
  if (renderPage) {
    for (const v of [...pages, ...exiting.map((e) => e.key)]) {
      if (shown.has(v) || !present(v)) continue;
      const node = renderPage(v);
      if (node == null) continue;
      kept.current.set(v, node as ReactElement);
      shown.add(v);
      out.push({ key: 'p:' + v, node });
    }
  }
  order.current.forEach((v, i) => {
    if (shown.has(v)) return;
    const el = kept.current.get(v);
    if (!el || !present(v)) { kept.current.delete(v); return; }
    // After the page that came before it last time.
    const before = order.current.slice(0, i).reverse().find((b) => out.some((o) => o.key === 'p:' + b));
    const at = before ? out.findIndex((o) => o.key === 'p:' + before) + 1 : 0;
    out.splice(at, 0, { key: 'p:' + v, node: el });
  });
  order.current = out.map((o) => o.key).filter((k) => k.startsWith('p:')).map((k) => k.slice(2));

  // Titles fly between bars on a push and a pop; a swipe scrubs its own flight.
  const flight = useRef<ReturnType<typeof createTitleFlight> | null>(null);
  useLayoutEffect(() => {
    if (!rootEl) return undefined;
    const f = createTitleFlight(rootEl, { parts: (p) => titleParts(p) ?? {} });
    flight.current = f;
    const off = swipes.onSwipe(f.swipe);
    return () => { off(); f.destroy(); flight.current = null; };
  }, [rootEl, swipes]);
  const prev = useRef(pages);
  useLayoutEffect(() => {
    const old = prev.current;
    prev.current = pages;
    const from = old.at(-1), to = pages.at(-1);
    if (!rootEl || from === undefined || to === undefined || from === to) return;
    const pageEl = (k: string) => [...rootEl.children].find((e): e is HTMLElement => e instanceof HTMLElement && e.dataset.value === k);
    if (!old.includes(to)) {
      flight.current?.fly(() => [pushedTitle(titleParts(pageEl(from))), backLabel(titleParts(pageEl(to))), pageEl(to)], pageEl(from));
    } else {
      // A pop a swipe made has flown with the finger already: `fly` skips it.
      flight.current?.fly(() => [backLabel(titleParts(pageEl(from))), shownTitle(titleParts(pageEl(to))), pageEl(to)], pageEl(from));
    }
  }, [pages, rootEl]);

  const ctx = { api, titles, rootBack, bottomInset };
  // Inside its pages the way back is the stack's own: a stack nested in a page gets no parent.
  return (
    <StackCtx value={ctx}>
      <StackParentContext value={null}>
        {out.map((o) => <Fragment key={o.key}>{o.node}</Fragment>)}
      </StackParentContext>
    </StackCtx>
  );
}

/* ── Page ── */

export interface NavigationStackPageProps extends Omit<ComponentProps<typeof Page>, 'value'> {
  /** The page's key in `pages`. */
  value: string;
  /** The page's background: `plain` (default, `bg-background`) or `grouped` (`bg-muted`, for inset-grouped lists). */
  variant?: 'plain' | 'grouped';
}

/** One page: its bar, its content, and anything else that floats over it (an index bar, a tab bar). */
export function NavigationStackPage({ value, variant = 'plain', className, style, children, ...props }: NavigationStackPageProps) {
  const safeTop = use(BLSafeCtx);
  return (
    // Position is CSS: at rest, waiting off the trailing edge to enter or leave, parallaxed 30% under the page on
    // top, following `--stack-progress` while an edge swipe moves it, and settling on the tray spring once it lets
    // go. Every offset is times `--stack-dir` (-1 right to left), so the trailing and leading edges follow the
    // reading direction, as the swipe's edge does. The same tuning as a compact SplitView's columns.
    <Page {...props} value={value}
      className={(s) => cn(
        'group/page absolute inset-0 z-(--page-z) overflow-hidden outline-none will-change-transform rtl:[--stack-dir:-1]',
        '[transform:translateX(0)] data-covered:[transform:translateX(calc(-30%*var(--stack-dir,1)))] data-starting-style:[transform:translateX(calc((100%_+_24px)*var(--stack-dir,1)))] data-ending-style:not-data-covered:[transform:translateX(calc((100%_+_24px)*var(--stack-dir,1)))]',
        'data-swiping:not-data-covered:[transform:translateX(calc(var(--stack-progress,0)*100%*var(--stack-dir,1)))] data-swiping:data-covered:[transform:translateX(calc((-30%_+_var(--stack-progress,0)*30%)*var(--stack-dir,1)))]',
        'transition-transform duration-spring-smooth ease-spring-smooth data-swiping:transition-none data-swipe-settling:duration-spring-tray data-swipe-settling:ease-spring-tray motion-reduce:transition-none',
        variant === 'grouped' ? 'bg-muted' : 'bg-background',
        s.depth > 0 && 'shadow-edge-left rtl:shadow-edge-right',
        s.leaving ? 'pointer-events-none' : 'pointer-events-auto',
        classOf(className, s),
      )}
      style={(s) => ({
        '--page-z': 10 + s.depth * 2 - (s.leaving && s.covered ? 1 : 0),
        '--screen-bar-h': safeTop + BARH + 'px',
        '--screen-safe-top': safeTop + 'px',
        ...styleOf(style, s),
      } as CSSProperties)}>
      <PageCtx value={value}>
        {children as ReactNode}
        <Shade value={value}
          className="pointer-events-none absolute inset-0 z-200 bg-black opacity-0 transition-opacity duration-spring-smooth ease-spring-smooth [[data-covered]>&]:opacity-10 [[data-swiping][data-covered]>&]:opacity-[calc(.1*(1-var(--stack-progress,0)))] [[data-swiping]>&]:transition-none" />
      </PageCtx>
    </Page>
  );
}

/* ── Bar ── */

export interface NavigationStackBarProps extends Omit<ComponentProps<typeof Bar>, 'value' | 'children'> {
  /** Scrolling down slides the bar away (and the shared chrome with it). Default true. */
  hideOnScroll?: boolean;
  children?: ReactNode;
}

/** The navigation bar: a back button when there is a page to go back to, then its leading items, title and
 *  trailing items. Its background (the iOS bar surface, `barSurface`) fades in once the content scrolls under it. */
export function NavigationStackBar({ hideOnScroll = true, className, children, ...props }: NavigationStackBarProps) {
  const value = usePageKey('NavigationStackBar');
  const { rootBack } = useStack('NavigationStackBar');
  const safeTop = use(BLSafeCtx);
  const rowRef = useRef<HTMLDivElement | null>(null);
  return (
    <Bar {...props} value={value} hideOnScroll={hideOnScroll}
      className={(s) => cn(
        'absolute inset-x-0 top-0 z-30 box-border flex h-(--screen-bar-h) items-end px-1.5 pt-(--screen-safe-top) transition-transform duration-spring-smooth ease-spring-smooth',
        s.hidden ? '[transform:translateY(calc(var(--screen-safe-top)-var(--screen-bar-h)))]' : '[transform:none]',
        classOf(className, s),
      )}>
      {(s) => {
        const back = s.previous !== null || (s.depth === 0 && !s.leaving && !!rootBack);
        return (
          <>
            <div data-side="top" className={cn(
              barSurface, 'absolute inset-0 h-auto transition-opacity duration-spring-snappy ease-spring-snappy',
              s.scrolled ? 'opacity-100' : 'opacity-0',
            )} />
            {/* Under-island strip: stays put while the bar slides away, so content never runs under the camera. */}
            {safeTop ? (
              <div className={cn(
                'absolute inset-x-0 top-0 h-(--screen-safe-top) transition-transform duration-spring-smooth ease-spring-smooth', barMaterial,
                s.scrolled || s.hidden ? 'opacity-100' : 'opacity-0',
                s.hidden ? '[transform:translateY(calc(var(--screen-bar-h)-var(--screen-safe-top)))]' : '[transform:none]',
              )} />
            ) : null}
            <div ref={rowRef} className={cn('flex h-toolbar w-full items-center transition-opacity duration-spring-snappy ease-spring-snappy', s.hidden ? 'opacity-0' : 'opacity-100')}>
              {back ? <AutoBack row={rowRef} state={s} /> : null}
              <BarCtx value={back}>{children}</BarCtx>
            </div>
          </>
        );
      }}
    </Bar>
  );
}

/** The bar's own back button, its label measured against what the centered title leaves on its side
 *  (lib/nav-bar, shared with SplitViewHeader). */
function AutoBack({ row, state }: { row: { current: HTMLDivElement | null }; state: NavigationStackPageState }) {
  const { titles, rootBack } = useStack('NavigationStackBack');
  const previous = useTitle(titles, state.previous);
  const label = state.previous === null && rootBack ? rootBack.title ?? 'Back' : previous;
  const fit = useBackFit(row, label, () =>
    [...(row.current?.children ?? [])].find((e): e is HTMLElement => e instanceof HTMLElement && e.dataset.slot === 'navigation-stack-title'));
  return (
    <div className="relative z-1 flex min-w-[44px] items-center">
      <NavigationStackBack aria-label={backName(label)}>
        <BackLabel fit={fit} label={label} />
      </NavigationStackBack>
      {fit.rulers}
    </div>
  );
}

export type NavigationStackBackProps = Omit<ComponentProps<typeof Back>, 'value'>;

/** A back button: pops the page it is in (`trigger-press`), or on the first page runs the stack's `rootBack`. The
 *  bar draws one by itself; use this for a back button of your own. */
export function NavigationStackBack({ className, ...props }: NavigationStackBackProps) {
  const value = usePageKey('NavigationStackBack');
  return <Back {...props} value={value} className={(s) => cn(barBackButton, classOf(className, s))} />;
}

export type NavigationStackTitleProps = Omit<ComponentProps<typeof Title>, 'value' | 'children'> & {
  /** Fades in only once the content has scrolled (a detail page's title). A page with a large title does this
   *  by itself. */
  showOnScroll?: boolean;
  children?: ReactNode;
};

/** The bar's centered title. It names the page: the next page's back label, and the large title by default.
 *  While it is faded out it is out of the accessibility tree too (the large title is the page's heading). */
export function NavigationStackTitle({ showOnScroll, className, children, ...props }: NavigationStackTitleProps) {
  const value = usePageKey('NavigationStackTitle');
  const { titles } = useStack('NavigationStackTitle');
  useLayoutEffect(() => {
    titles.set(value, children);
    return () => titles.delete(value, children);
  }, [titles, value, children]);
  return (
    <Title {...props} value={value} showOnScroll={showOnScroll}
      className={(s) => cn(barTitle, barTitleFade, (showOnScroll || s.large) && !s.scrolled && barTitleHidden, classOf(className, s))}>
      {(s) => <span aria-hidden={(showOnScroll || s.large) && !s.scrolled ? true : undefined}>{children}</span>}
    </Title>
  );
}

export type NavigationStackLeadingProps = Omit<ComponentProps<typeof Leading>, 'value'>;

/** Bar items at the leading edge. A page with a back button shows that instead. */
export function NavigationStackLeading({ className, ...props }: NavigationStackLeadingProps) {
  const value = usePageKey('NavigationStackLeading');
  if (use(BarCtx)) return null;
  return <Leading {...props} value={value} className={(s) => cn('relative z-1 flex min-w-[44px] items-center', classOf(className, s))} />;
}

export type NavigationStackTrailingProps = Omit<ComponentProps<typeof Trailing>, 'value'>;

/** Bar items at the trailing edge. */
export function NavigationStackTrailing({ className, ...props }: NavigationStackTrailingProps) {
  const value = usePageKey('NavigationStackTrailing');
  return <Trailing {...props} value={value} className={(s) => cn('relative z-1 ms-auto flex items-center', classOf(className, s))} />;
}

/* ── Content ── */

export interface NavigationStackContentProps extends Omit<ComponentProps<typeof Content>, 'value' | 'children'> {
  /** Pull to refresh (touch). Return a promise to keep the spinner until it settles; it shows for a moment at
   *  least. The controller's `refresh()` runs it from a button or a key. */
  onRefresh?: () => unknown;
  /** A readable width the content centers at on a wide page. */
  maxWidth?: number | string;
  /** Extra room kept under the content (px), on top of a tab bar's (`--tabs-bar-h`). Defaults to the stack's
   *  `bottomInset`. */
  bottomInset?: number;
  children?: ReactNode;
}

/** The page's scrolling content, under the bar. Sticky section headers inside stick under the bar. */
export function NavigationStackContent({ onRefresh, maxWidth, bottomInset, className, style, children, ...props }: NavigationStackContentProps) {
  const value = usePageKey('NavigationStackContent');
  const stack = useStack('NavigationStackContent');
  const safeTop = use(BLSafeCtx);
  const inset = bottomInset ?? stack.bottomInset;
  return (
    <Content {...props} value={value} onRefresh={onRefresh}
      className={(s) => cn('group/nav-scroll bl-scroll absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]', classOf(className, s))}
      style={(s) => ({
        '--screen-max-w': maxWidth == null || maxWidth === 0 || maxWidth === '' ? 'none' : typeof maxWidth === 'number' ? maxWidth + 'px' : maxWidth,
        // A tab bar around (Tabs `bar`, a SplitView sidebar as one) publishes how much it covers, safe area included.
        '--screen-inset': `calc(var(--tabs-bar-h, 0px) + ${inset + 28}px)`,
        ...styleOf(style, s),
      } as CSSProperties)}>
      {(s) => (
        <>
          {onRefresh ? (
            <RefreshIndicator value={value}
              className="pointer-events-none absolute top-[calc(var(--screen-bar-h)+8px)] left-1/2 z-5 text-muted-foreground opacity-[var(--pull-progress,0)] [transform:translateX(-50%)_rotate(calc(var(--pull-progress,0)*166deg))_scale(min(1,calc(.5_+_var(--pull-progress,0)*.58)))] transition-opacity duration-spring-snappy ease-spring-snappy group-data-pulling/nav-scroll:transition-none group-data-pending/nav-scroll:opacity-100 group-data-pending/nav-scroll:[transform:translateX(-50%)]">
              <Spinner paused={!s.refreshing} />
            </RefreshIndicator>
          ) : null}
          {/* The content follows a pull, and holds open while the refresh runs. */}
          <div className="mx-auto box-border w-full max-w-(--screen-max-w) transition-transform duration-spring-snappy ease-spring-snappy group-data-pulling/nav-scroll:transition-none group-data-pulling/nav-scroll:[transform:translateY(var(--pull-distance,0px))] group-data-pending/nav-scroll:[transform:translateY(var(--pull-distance,0px))]">
            <div className="h-(--screen-bar-h)" />
            <BLStickyCtx.Provider value={safeTop + BARH}>{children}</BLStickyCtx.Provider>
            <div className="h-(--screen-inset)" />
          </div>
        </>
      )}
    </Content>
  );
}

export type NavigationStackLargeTitleProps = Omit<ComponentProps<typeof LargeTitle>, 'value' | 'children'> & {
  /** Defaults to the page's NavigationStackTitle. */
  children?: ReactNode;
};

/** iOS's large title, at the top of the content and the page's heading: it scrolls under the bar, where the inline
 *  title takes over. */
export function NavigationStackLargeTitle({ className, children, ...props }: NavigationStackLargeTitleProps) {
  const value = usePageKey('NavigationStackLargeTitle');
  const { titles } = useStack('NavigationStackLargeTitle');
  const title = useTitle(titles, value);
  return (
    <LargeTitle {...props} value={value} className={(s) => cn('px-4 pt-1 pb-2', classOf(className, s))}>
      {/* A heading role, not an <h1>: host prose styles (a docs page's `.markdown h1`) would otherwise restyle it. */}
      <div role="heading" aria-level={1} className={largeTitleText}><span>{children ?? title}</span></div>
    </LargeTitle>
  );
}

export type NavigationStackSubheaderProps = Omit<ComponentProps<typeof Subheader>, 'value'>;

/** Under the large title: a search field, a segmented control. */
export function NavigationStackSubheader({ className, ...props }: NavigationStackSubheaderProps) {
  const value = usePageKey('NavigationStackSubheader');
  return <Subheader {...props} value={value} className={(s) => cn('mt-1 px-4 pb-1.5', classOf(className, s))} />;
}

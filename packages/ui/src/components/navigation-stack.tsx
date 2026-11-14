'use client';
import {
  Children, createContext, Fragment, isValidElement, use, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type ComponentProps, type CSSProperties, type ReactElement, type ReactNode,
} from 'react';
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { Icon } from '@/lib/icon';
import { chromeStore, BLSafeCtx, BLStickyCtx } from '@/lib/theme';
import { cn, BARH } from '@/lib/utils';
import { SizeClassProvider } from '@/lib/container';
import type { SizeClass } from '@/lib/size-class';
import type { Stack } from '@/lib/stack';
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
import { useSplitViewBack } from '@/components/ui/split-view';

export { createNavigationStackController };
export type {
  NavigationStackChangeDetails, NavigationStackChangeOptions, NavigationStackController, NavigationStackPageState,
  NavigationStackReason,
};

/* ══ NavigationStack — iOS's navigation controller ══
   A stack of pages in its own box: push slides a page in from the trailing edge over the one under it, which
   parallaxes back under a shade; pop reverses it. The back button names the page behind (the previous title when it
   fits beside the centered title, "Back" when only a sliver is left, else the chevron alone) and its title flies
   into it on a push, and back on a pop. Escape, the platform back and a swipe from the leading edge pop the
   innermost stack first; focus goes into a pushed page and back to what pushed it. Large titles collapse into the bar
   on scroll, the bar rides away as the content scrolls down (with any `Tabs` bar, through the shared chrome state), and
   a page can pull to refresh. Built on the `navigationStack` primitive (lib/navigation-stack-primitive.ts).

   <NavigationStack pages={pages} onPagesChange={setPages}>
     <NavigationStackPage value="list">
       <NavigationStackBar><NavigationStackTitle>Contacts</NavigationStackTitle></NavigationStackBar>
       <NavigationStackContent><NavigationStackLargeTitle /> …rows</NavigationStackContent>
     </NavigationStackPage>
     {sel && <NavigationStackPage value="detail">…</NavigationStackPage>}
   </NavigationStack>

   Pages are the stack's direct children (or in fragments and arrays), each with a `value`. Render every page that is
   in `pages`; a page dropped from the children while it pops is kept on screen until it has slid out. ══ */

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
   page above it and a SplitView's back label. ── */
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
 *  button that pops. Null outside a NavigationStack. */
export function useNavigationStack(): NavigationStackController | null {
  return use(StackCtx)?.api ?? null;
}

/* ── Root ── */

type SwipeSource = { onSwipe: (fn: (swipe: NavigationStackSwipe) => void) => () => void };

type RootState = { pages: string[]; exiting: { key: string; covered: boolean }[]; sizeClass: SizeClass | undefined };

export interface NavigationStackProps
  extends Omit<ComponentProps<'div'>, 'className' | 'style' | 'children'>,
    Omit<NavigationStackOptions, 'onRootBack'> {
  className?: string | ((state: RootState) => string | undefined);
  style?: CSSProperties | ((state: RootState) => CSSProperties | undefined);
  children?: ReactNode;
  /** A back button on the first page, for a stack that sits under something else to go back to. Inside a
   *  collapsed SplitView column it defaults to the previous column (the sidebar), labelled with its title;
   *  `false` turns that off. */
  rootBack?: NavigationStackRootBack | false;
  /** Safe-area top for this stack (px). Usually inherited from BLProvider instead. */
  safeTop?: number | string;
  /** Room kept under every page's content for bars that ride over it (px), unless a page's content sets its own. */
  bottomInset?: number;
}

/** The stack root. `pages` / `defaultPages` / `onPagesChange(pages, details)` hold its pages by key, bottom to top
 *  (`details.reason`: `trigger-press`, `escape-key`, `back`, `swipe` or `imperative`); `controller` drives it. */
export function NavigationStack({
  pages, defaultPages, onPagesChange, controller, onBarHiddenChange,
  rootBack, safeTop, bottomInset = 0, className, children, ...props
}: NavigationStackProps) {
  const [titles] = useState(createTitles);
  const inheritedSafeTop = use(BLSafeCtx);
  const safe = safeTop != null ? parseFloat(String(safeTop)) || 0 : inheritedSafeTop;
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
  const handle = usePrimitive(navigationStack, {
    pages, defaultPages, controller, onPagesChange, onRootBack, onBarHiddenChange: onHidden,
  });
  const api = handle.api as unknown as NavigationStackController;
  const { stack, internal } = handle.api as unknown as { stack: Stack; internal: SwipeSource };
  const root = usePart(handle, 'root', {}, {
    ...props,
    ref: setRef,
    className: (s: RootState) => cn('absolute inset-0 touch-pan-y overflow-hidden', classOf(className, s)),
    children: (state: RootState) => (
      <SizeClassProvider value={state.sizeClass}>
        <Pages pages={state.pages} present={(page) => stack.present(state, page)} api={api} titles={titles} rootEl={rootEl}
          rootBackProp={rootBack} rootBackRef={rootBackRef} swipes={internal} bottomInset={bottomInset}>
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
  /** Whether a page renders: in the stack, or leaving (`createStack`'s `present`). */
  present: (page: string) => boolean;
  titles: Titles;
  rootEl: HTMLDivElement | null;
  rootBackProp: NavigationStackRootBack | false | undefined;
  rootBackRef: { current: NavigationStackRootBack | null };
  /** The stack's edge swipe, for the title flight to follow. */
  swipes: SwipeSource;
  bottomInset: number;
  children: ReactNode;
}

function Pages({ api, pages, present, titles, rootEl, rootBackProp, rootBackRef, swipes, bottomInset, children }: PagesProps) {
  const rootTitle = useTitle(titles, pages[0]);
  const split = useSplitViewBack(typeof rootTitle === 'string' ? rootTitle : undefined);
  const rootBack = rootBackProp === false ? null : rootBackProp ?? (split ? { title: split.title, onClick: split.back } : null);
  rootBackRef.current = rootBack;

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
  return <StackCtx value={ctx}>{out.map((o) => <Fragment key={o.key}>{o.node}</Fragment>)}</StackCtx>;
}

/* ── Page ── */

export interface NavigationStackPageProps extends Omit<ComponentProps<typeof Page>, 'value'> {
  /** The page's key in `pages`. */
  value: string;
  /** The inset-grouped background (`bg-muted`), for pages of grouped lists. */
  grouped?: boolean;
}

/** One page: its bar, its content, and anything else that floats over it (an index bar, a tab bar). */
export function NavigationStackPage({ value, grouped, className, style, children, ...props }: NavigationStackPageProps) {
  const safeTop = use(BLSafeCtx);
  return (
    // Position is CSS: at rest, waiting off the trailing edge to enter or leave, parallaxed under the page on top,
    // following `--stack-progress` while an edge swipe moves it, and settling on the tray spring once it lets go.
    // Every offset is times `--stack-dir` (-1 right to left), so the trailing and leading edges follow the reading
    // direction, as the swipe's edge does.
    <Page {...props} value={value}
      className={(s) => cn(
        'group/page absolute inset-0 z-(--page-z) overflow-hidden outline-none will-change-transform rtl:[--stack-dir:-1]',
        '[transform:translateX(0)] data-covered:[transform:translateX(calc(-28%*var(--stack-dir,1)))] data-starting-style:[transform:translateX(calc(103%*var(--stack-dir,1)))] data-ending-style:not-data-covered:[transform:translateX(calc(103%*var(--stack-dir,1)))]',
        'data-swiping:not-data-covered:[transform:translateX(calc(var(--stack-progress,0)*100%*var(--stack-dir,1)))] data-swiping:data-covered:[transform:translateX(calc((-28%_+_var(--stack-progress,0)*28%)*var(--stack-dir,1)))]',
        'transition-transform duration-spring-smooth ease-spring-smooth data-swiping:transition-none data-swipe-settling:duration-spring-tray data-swipe-settling:ease-spring-tray motion-reduce:transition-none',
        grouped ? 'bg-muted' : 'bg-background',
        s.depth > 0 && 'shadow-[-10px_0_30px_black] shadow-black/16 rtl:shadow-[10px_0_30px_black]',
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
          className="pointer-events-none absolute inset-0 z-200 bg-black opacity-0 transition-opacity duration-spring-smooth ease-spring-smooth [[data-covered]>&]:opacity-12 [[data-swiping][data-covered]>&]:opacity-[calc(.12*(1-var(--stack-progress,0)))] [[data-swiping]>&]:transition-none" />
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
 *  trailing items. Its background fades in once the content scrolls under it. */
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
            <div className={cn(
              'absolute inset-0 [border-bottom:1px_solid_var(--border)] bg-bar backdrop-blur-[18px] backdrop-saturate-[1.7] transition-opacity duration-spring-snappy ease-spring-snappy',
              s.scrolled ? 'opacity-100' : 'opacity-0',
            )} />
            {/* Under-island strip: stays put while the bar slides away, so content never runs under the camera. */}
            {safeTop ? (
              <div className={cn(
                'absolute inset-x-0 top-0 h-(--screen-safe-top) bg-bar backdrop-blur-[18px] backdrop-saturate-[1.7] transition-transform duration-spring-smooth ease-spring-smooth',
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

/** Back label: the previous title (ellipsized when tight), "Back" when even that has no room, else nothing. */
type BackMode = 'title' | 'back' | 'none';

/** The bar's own back button, its label measured against what the centered title leaves on its side. */
function AutoBack({ row, state }: { row: { current: HTMLDivElement | null }; state: NavigationStackPageState }) {
  const value = usePageKey('NavigationStackBack');
  const { titles, rootBack } = useStack('NavigationStackBack');
  const previous = useTitle(titles, state.previous);
  const own = useTitle(titles, value);
  const backTitle = state.previous === null && rootBack ? rootBack.title ?? 'Back' : previous;
  const measFull = useRef<HTMLSpanElement | null>(null);
  const measBack = useRef<HTMLSpanElement | null>(null);
  const [bk, setBk] = useState<{ mode: BackMode; w: number }>({ mode: 'title', w: 160 });
  useLayoutEffect(() => {
    const r = row.current, f = measFull.current, b = measBack.current;
    if (!r || !f || !b) return undefined;
    const title = () => [...r.children].find((e): e is HTMLElement => e instanceof HTMLElement && e.dataset.slot === 'navigation-stack-title');
    const m = () => {
      const t = title();
      const tw = t ? t.offsetWidth : 0;
      // Half the row beside the title, less the chevron (24), the button's end padding (8) and a gap (8).
      const avail = Math.floor((r.clientWidth - tw) / 2 - 40);
      const fw = f.offsetWidth, bw = b.offsetWidth;
      const mode: BackMode = fw > 0 && (avail >= fw || avail >= bw + 14) ? 'title' : avail >= bw ? 'back' : 'none';
      setBk((o) => (o.mode === mode && o.w === avail ? o : { mode, w: Math.max(0, avail) }));
    };
    m();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(m);
    [r, f, b].forEach((e) => ro.observe(e));
    const t = title();
    if (t) ro.observe(t);
    return () => ro.disconnect();
  }, [row, backTitle, own]);
  return (
    <div className="relative z-1 flex min-w-[44px] items-center">
      <NavigationStackBack aria-label={bk.mode === 'none' ? 'Back' : undefined}>
        <Icon name="chevL" size={24} sw={2.4} className="rtl:-scale-x-100" />
        {bk.mode !== 'none' ? (
          <span data-mode={bk.mode} className="max-w-(--back-w) truncate" style={{ '--back-w': bk.w + 'px' } as CSSProperties}>
            {bk.mode === 'title' ? backTitle : 'Back'}
          </span>
        ) : null}
      </NavigationStackBack>
      {/* Off-screen rulers for the full previous title and for "Back". */}
      <span aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 flex text-body whitespace-nowrap">
        <span ref={measFull}>{backTitle}</span><span ref={measBack}>Back</span>
      </span>
    </div>
  );
}

export type NavigationStackBackProps = Omit<ComponentProps<typeof Back>, 'value'>;

/** A back button: pops the page it is in (`trigger-press`), or on the first page runs the stack's `rootBack`. The
 *  bar draws one by itself; use this for a back button of your own. */
export function NavigationStackBack({ className, ...props }: NavigationStackBackProps) {
  const value = usePageKey('NavigationStackBack');
  return (
    <Back {...props} value={value}
      className={(s) => cn('bl-btn flex cursor-pointer items-center border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-body text-primary', classOf(className, s))} />
  );
}

export type NavigationStackTitleProps = Omit<ComponentProps<typeof Title>, 'value' | 'children'> & {
  /** Fades in only once the content has scrolled (a detail page's title). A page with a large title does this
   *  by itself. */
  showOnScroll?: boolean;
  children?: ReactNode;
};

/** The bar's centered title. It names the page: the next page's back label, and the large title by default. */
export function NavigationStackTitle({ showOnScroll, className, children, ...props }: NavigationStackTitleProps) {
  const value = usePageKey('NavigationStackTitle');
  const { titles } = useStack('NavigationStackTitle');
  useLayoutEffect(() => {
    titles.set(value, children);
    return () => titles.delete(value, children);
  }, [titles, value, children]);
  return (
    <Title {...props} value={value} showOnScroll={showOnScroll}
      className={(s) => cn(
        'pointer-events-none absolute left-1/2 max-w-[52%] -translate-x-1/2 truncate text-body font-semibold text-foreground transition-opacity duration-spring-snappy ease-spring-snappy',
        (showOnScroll || s.large) && !s.scrolled ? 'opacity-0' : 'opacity-100',
        classOf(className, s),
      )}>
      {children}
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
  return <Trailing {...props} value={value} className={(s) => cn('relative z-1 ml-auto flex items-center', classOf(className, s))} />;
}

/* ── Content ── */

export interface NavigationStackContentProps extends Omit<ComponentProps<typeof Content>, 'value' | 'children'> {
  /** Pull to refresh (touch). Return a promise to keep the spinner until it settles; it shows for a moment at
   *  least. The controller's `refresh()` runs it from a button or a key. */
  onRefresh?: () => unknown;
  /** A readable width the content centers at on a wide page. */
  maxWidth?: number | string;
  /** Room kept under the content for bars that ride over it (px). Defaults to the stack's `bottomInset`. */
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
        '--screen-inset': inset + 28 + 'px',
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

/** iOS's large title, at the top of the content: it scrolls under the bar, where the inline title takes over. */
export function NavigationStackLargeTitle({ className, children, ...props }: NavigationStackLargeTitleProps) {
  const value = usePageKey('NavigationStackLargeTitle');
  const { titles } = useStack('NavigationStackLargeTitle');
  const title = useTitle(titles, value);
  return (
    <LargeTitle {...props} value={value} className={(s) => cn('px-4 pt-0.5 pb-1.5', classOf(className, s))}>
      <div className="text-[34px] leading-[1.15] font-extrabold tracking-[-.5px]"><span>{children ?? title}</span></div>
    </LargeTitle>
  );
}

export type NavigationStackSubheaderProps = Omit<ComponentProps<typeof Subheader>, 'value'>;

/** Under the large title: a search field, a segmented control. */
export function NavigationStackSubheader({ className, ...props }: NavigationStackSubheaderProps) {
  const value = usePageKey('NavigationStackSubheader');
  return <Subheader {...props} value={value} className={(s) => cn('mt-1 px-4 pb-1.5', classOf(className, s))} />;
}

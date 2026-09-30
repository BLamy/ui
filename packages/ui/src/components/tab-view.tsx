import {
  Children, createContext, isValidElement, useContext, useLayoutEffect, useReducer, useRef, useState,
  type CSSProperties, type HTMLAttributes, type ReactNode, type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Button as AriaButton, type ButtonProps as AriaButtonProps,
  SelectionIndicator,
  Tab as AriaTab, type TabProps as AriaTabProps, type TabRenderProps,
  TabList as AriaTabList, type TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel, type TabPanelProps as AriaTabPanelProps,
  TabPanels as AriaTabPanels, type TabPanelsProps as AriaTabPanelsProps,
  TabListStateContext,
  Tabs as AriaTabs, type TabsProps as AriaTabsProps,
  composeRenderProps, createLeafComponent,
} from 'react-aria-components';
import { cva } from 'class-variance-authority';
import { Icon } from '../lib/icon';
import { useChromeHidden } from '../lib/theme';
import { cn } from '../lib/utils';
import { TabDirection, useTabPanelDirection } from './tabs';

/* ══ TabView — a compositional tab container on react-aria's Tabs.

   <TabView placement="start">                 root: selection, orientation, where the bar sits
     <TabViewBar>                              the bar's surface (iOS bar / side rail / plain)
       <TabViewHeader>…</TabViewHeader>         anything that isn't a tab: logos, titles
       <TabViewList aria-label="Sections">     the tablist — arrow keys follow the orientation
         <TabViewTab id="a" icon="person" title="Contacts" />
         <TabViewSeparator />                  decorative, skipped by the keyboard
         <TabViewTab id="b">{({ isSelected }) => …}</TabViewTab>   fully custom tab
       </TabViewList>
       <TabViewAction aria-label="Add">…</TabViewAction>           a button, not a tab
       <TabViewFooter>…</TabViewFooter>
     </TabViewBar>
     <TabViewPanels><TabViewPanel id="a">…</TabViewPanel>…</TabViewPanels>
   </TabView>

   Placement `top`/`bottom` is horizontal, `start`/`end` vertical.

   Order doesn't matter: the bar and the panels may be written either way round. react-aria needs the tablist
   to render before any panel (it mints the ids panels point at, on every render), so TabView moves a bar/list
   that is its direct child ahead of the panels (which also keeps `placement` right). When the bar is nested
   deeper and comes after the panels, TabViewPanels leaves a box-less placeholder where it was written and
   the panels are rendered after everything else — portalled back into that placeholder. ══ */

export type TabViewPlacement = 'top' | 'bottom' | 'start' | 'end';
export type TabViewOrientation = 'horizontal' | 'vertical';
export type TabViewBarVariant = 'bar' | 'rail' | 'workspace' | 'plain';

interface TabViewCtxValue {
  orientation: TabViewOrientation;
  placement: TabViewPlacement;
  variant: TabViewBarVariant;
}
const TabViewCtx = createContext<TabViewCtxValue>({ orientation: 'horizontal', placement: 'bottom', variant: 'bar' });

/* Panels outlet: with a nested bar, TabViewPanels hands its panels to an outlet rendered after all of
   TabView's children (so after the tablist, whatever the nesting), which portals them into its box. */
interface PanelsStore {
  /** Tab list states the tablist has rendered with (react-aria mints the panel ids per state object). */
  seen: WeakSet<object>;
  content: ReactNode;
  host: HTMLElement | null;
  set: (content: ReactNode, host: HTMLElement | null) => void;
  subscribe: (fn: () => void) => () => void;
}
function createPanelsStore(): PanelsStore {
  const subs = new Set<() => void>();
  const store: PanelsStore = {
    seen: new WeakSet(),
    content: null,
    host: null,
    set(content, host) { store.content = content; store.host = host; subs.forEach((f) => f()); },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
  };
  return store;
}
const PanelsOutletCtx = createContext<PanelsStore | null>(null);

function PanelsOutlet({ store }: { store: PanelsStore }) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => store.subscribe(force), [store]);
  return store.content && store.host ? createPortal(store.content, store.host) : null;
}

const isBar = (c: ReactNode) => isValidElement(c) && (c.type === TabViewBar || c.type === TabViewList);
const isPanels = (c: ReactNode) => isValidElement(c) && c.type === TabViewPanels;

/** Moves a bar / list that is a direct child ahead of the panels, keeping everything else in place, and
 *  ends with the outlet a nested-bar-after-panels layout needs. */
function Ordered({ kids, store }: { kids: ReactNode; store: PanelsStore }) {
  const arr = Children.toArray(kids);
  const firstPanels = arr.findIndex(isPanels);
  let out: ReactNode = kids;
  if (firstPanels >= 0 && arr.slice(firstPanels).some(isBar)) {
    const bars = arr.filter((c, i) => i > firstPanels && isBar(c));
    const rest = arr.filter((c, i) => !(i > firstPanels && isBar(c)));
    rest.splice(firstPanels, 0, ...bars);
    out = rest;
  }
  return (
    <PanelsOutletCtx.Provider value={store}>
      {out}
      <PanelsOutlet store={store} />
    </PanelsOutletCtx.Provider>
  );
}
/** The enclosing TabView's orientation, placement and bar variant. */
export const useTabView = () => useContext(TabViewCtx);

const TabItemCtx = createContext<TabRenderProps | null>(null);
/** Inside a TabViewTab: its react-aria render state (isSelected, isHovered, isFocusVisible, …). */
export const useTabViewTab = () => useContext(TabItemCtx);

export const tabViewVariants = cva('flex min-h-0 min-w-0', {
  variants: {
    placement: {
      top: 'flex-col',
      bottom: 'flex-col-reverse',
      start: 'flex-row',
      end: 'flex-row-reverse',
    },
  },
  defaultVariants: { placement: 'bottom' },
});

export interface TabViewProps extends Omit<AriaTabsProps, 'orientation'> {
  /** Where the bar sits. `top`/`bottom` → horizontal, `start`/`end` → vertical. */
  placement?: TabViewPlacement;
  /** Overrides the orientation implied by `placement` (vertical alone means `start`). */
  orientation?: TabViewOrientation;
}

export function TabView({ placement, orientation, className, children, ...props }: TabViewProps) {
  const place: TabViewPlacement = placement ?? (orientation === 'vertical' ? 'start' : 'bottom');
  const orient: TabViewOrientation = orientation ?? (place === 'start' || place === 'end' ? 'vertical' : 'horizontal');
  const [store] = useState(createPanelsStore);
  return (
    <TabViewCtx.Provider value={{ orientation: orient, placement: place, variant: orient === 'vertical' ? 'rail' : 'bar' }}>
      <AriaTabs
        data-slot="tab-view"
        data-placement={place}
        orientation={orient}
        className={composeRenderProps(className, (cls) => cn(tabViewVariants({ placement: place }), cls))}
        {...props}
      >
        {composeRenderProps(children, (kids) => <TabDirection><Ordered kids={kids} store={store} /></TabDirection>)}
      </AriaTabs>
    </TabViewCtx.Provider>
  );
}

/* ── Bar: the surface the list sits on ── */
export const tabViewBarVariants = cva('box-border', {
  variants: {
    variant: {
      /** iOS bottom tab bar — translucent, pinned over the content, hides with the scroll. */
      bar: 'absolute inset-x-0 bottom-0 z-120 flex h-[62px] [border-top:1px_solid_var(--border)] bg-bar pb-1 backdrop-blur-[20px] backdrop-saturate-[1.7] transition-transform duration-spring-smooth ease-spring-smooth',
      /** Vertical side rail — icons over labels. */
      rail: 'relative flex w-[76px] shrink-0 flex-col gap-1 bg-bar py-2 data-[placement=end]:[border-left:1px_solid_var(--border)] data-[placement=start]:[border-right:1px_solid_var(--border)]',
      /** Workspace switcher (Discord / Slack): a narrow column of tiles on the muted surface. Header and footer
       *  stay put; the list between them scrolls when there are more tiles than room. */
      workspace: 'flex w-[52px] shrink-0 flex-col items-center gap-[8px] border-r border-border bg-muted px-0 py-[10px]',
      /** No chrome: the host styles the bar. */
      plain: 'flex shrink-0 data-[orientation=vertical]:flex-col',
    },
  },
  defaultVariants: { variant: 'bar' },
});

export interface TabViewBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Defaults to `bar` when horizontal, `rail` when vertical. */
  variant?: TabViewBarVariant;
  /** `bar` only: follow the kit's scroll chrome (down hides, up shows). */
  hideOnScroll?: boolean;
}

export function TabViewBar({ variant, hideOnScroll = true, className, style, children, ...props }: TabViewBarProps) {
  const ctx = useContext(TabViewCtx);
  const v: TabViewBarVariant = variant ?? (ctx.orientation === 'vertical' ? 'rail' : 'bar');
  const hid = useChromeHidden() && hideOnScroll && v === 'bar';
  return (
    <TabViewCtx.Provider value={{ ...ctx, variant: v }}>
      <div data-slot="tab-view-bar" {...props} data-variant={v} data-orientation={ctx.orientation} data-placement={ctx.placement}
        className={cn(tabViewBarVariants({ variant: v }), hid && 'translate-y-full', className)} style={style}>
        {children}
      </div>
    </TabViewCtx.Provider>
  );
}

/* ── List: the tablist ── */
export const tabViewListVariants = cva('outline-none', {
  variants: {
    variant: {
      bar: 'flex flex-1',
      rail: 'flex flex-col gap-1 px-1.5',
      // Scrolls on its own; the padding (cancelled by the margin) keeps badges and focus rings from being clipped.
      workspace: 'flex min-h-0 w-full flex-col items-center gap-[8px] overflow-y-auto overscroll-contain -mt-1 -mb-1.5 pt-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      plain: 'flex data-[orientation=vertical]:flex-col',
    },
  },
  defaultVariants: { variant: 'plain' },
});

export function TabViewList<T extends object>({ className, ...props }: AriaTabListProps<T>) {
  const { variant } = useContext(TabViewCtx);
  // Real pass (not react-aria's collection pass): the tablist below mints the panel ids for this state.
  const state = useContext(TabListStateContext);
  const store = useContext(PanelsOutletCtx);
  if (state && store) store.seen.add(state);
  return (
    <AriaTabList
      data-slot="tab-view-list"
      className={composeRenderProps(className, (cls) => cn(tabViewListVariants({ variant }), cls))}
      {...props}
    />
  );
}

/* ── Tab ── */
export const tabViewTabVariants = cva('relative cursor-pointer outline-none', {
  variants: {
    variant: {
      bar: 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 text-center leading-[normal] [font-family:inherit] text-tertiary-foreground transition-[color] duration-spring-snappy ease-spring-snappy data-selected:text-primary data-focus-visible:rounded-[12px] data-focus-visible:ring-2 data-focus-visible:ring-ring/45 data-focus-visible:ring-inset',
      rail: 'bl-btn flex flex-col items-center justify-center gap-[3px] rounded-[12px] px-1 pt-[7px] pb-1.5 text-center leading-[normal] text-tertiary-foreground transition-[color,background-color] duration-spring-snappy ease-spring-snappy data-hovered:bg-secondary/60 data-hovered:text-muted-foreground data-pressed:bg-secondary data-selected:bg-primary/12 data-selected:text-primary data-focus-visible:ring-2 data-focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40',
      /** A full-width row that centers its tile; the tile styles itself from the tab's state (`group-data-*`). */
      workspace: 'group flex w-full shrink-0 justify-center data-disabled:cursor-default',
      plain: 'data-disabled:cursor-default',
    },
  },
  defaultVariants: { variant: 'plain' },
});

export interface TabViewTabProps extends AriaTabProps {
  /** Default content: an icon name (see `Icon`)… */
  icon?: string;
  /** …and a label. Ignored when `children` is given. */
  title?: ReactNode;
  /** Text for typeahead and accessibility when the content isn't plain text. */
  textValue?: string;
  ref?: Ref<HTMLDivElement>;
}

export function TabViewTab({ className, icon, title, children, ...props }: TabViewTabProps) {
  const { variant } = useContext(TabViewCtx);
  return (
    <AriaTab
      data-slot="tab-view-tab"
      className={composeRenderProps(className, (cls) => cn(tabViewTabVariants({ variant }), cls))}
      {...props}
    >
      {(rp) => (
        <TabItemCtx.Provider value={rp}>
          {children != null
            ? typeof children === 'function' ? children(rp) : children
            : <TabViewTabContent icon={icon} title={title} selected={rp.isSelected} />}
        </TabItemCtx.Provider>
      )}
    </AriaTab>
  );
}

function TabViewTabContent({ icon, title, selected }: { icon?: string; title?: ReactNode; selected: boolean }) {
  const { variant } = useContext(TabViewCtx);
  if (variant === 'rail') {
    return (
      <>
        {icon && <Icon name={icon} size={24} sw={selected ? 2.1 : 1.8} />}
        {title != null && <span className="text-[10.5px] font-semibold tracking-[.1px]">{title}</span>}
      </>
    );
  }
  return (
    <>
      {icon && <Icon name={icon} size={25} sw={selected ? 2.1 : 1.8} />}
      {title != null && <span className="text-[10px] font-semibold tracking-[.1px]">{title}</span>}
    </>
  );
}

/* ── Indicator ──
   `bar`: react-aria's SelectionIndicator — rendered in the selected tab and slid to the next one on change
   (a bottom underline when horizontal, a leading bar when vertical).
   `pill`: the Discord pill on the leading edge — a nub for `attention`, taller on hover, full when selected. */
export const tabViewIndicatorVariants = cva('pointer-events-none absolute', {
  variants: {
    variant: {
      bar: 'bg-primary transition-[translate,width,height] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
      pill: 'start-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-e-[4px] bg-foreground opacity-0 transition-[height,opacity] duration-spring-snappy ease-spring-snappy data-attention:h-1.5 data-attention:opacity-100 data-hovered:h-3.5 data-hovered:opacity-100 data-selected:h-7 data-selected:opacity-100',
    },
    orientation: {
      horizontal: '',
      vertical: '',
    },
  },
  compoundVariants: [
    { variant: 'bar', orientation: 'horizontal', className: 'inset-x-3 bottom-0 h-[2px] rounded-full' },
    { variant: 'bar', orientation: 'vertical', className: 'start-0 inset-y-2.5 w-[3px] rounded-e-full' },
  ],
  defaultVariants: { variant: 'bar', orientation: 'horizontal' },
});

export interface TabViewIndicatorProps {
  variant?: 'bar' | 'pill';
  /** `pill` only: show the small unread nub while not hovered/selected. */
  attention?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function TabViewIndicator({ variant = 'bar', attention, className, style }: TabViewIndicatorProps) {
  const { orientation, variant: bar } = useContext(TabViewCtx);
  const tab = useContext(TabItemCtx);
  const cls = cn(
    tabViewIndicatorVariants({ variant, orientation }),
    // The workspace pill grows on the bouncy spring, with the tile's corners.
    variant === 'pill' && bar === 'workspace' && 'duration-(--duration-spring-bouncy) ease-(--ease-spring-bouncy)',
    className,
  );
  if (variant === 'bar') return <SelectionIndicator data-slot="tab-view-indicator" className={cls} style={style} />;
  return (
    <span data-slot="tab-view-indicator" aria-hidden className={cls} style={style}
      data-selected={tab?.isSelected || undefined}
      data-hovered={(tab?.isHovered && !tab.isSelected) || undefined}
      data-attention={(attention && !tab?.isSelected && !tab?.isHovered) || undefined} />
  );
}

/* ── Non-tab parts ── */

interface SeparatorProps { className?: string; style?: CSSProperties }
const SeparatorItem = createLeafComponent('separator', (props: SeparatorProps & { isDisabled?: boolean }, ref) => {
  const { orientation, variant } = useContext(TabViewCtx);
  return (
    <div ref={ref as never} role="presentation" data-slot="tab-view-separator" data-orientation={orientation}
      className={cn('shrink-0 self-center bg-border',
        variant === 'workspace' ? 'my-[-1px] h-[2px] w-[20px] rounded-full' : orientation === 'vertical' ? 'h-px w-8' : 'h-6 w-px',
        props.className)}
      style={props.style} />
  );
});
/** A divider between tabs. It lives in the tablist's collection but is disabled, so arrow keys skip it. */
export function TabViewSeparator(props: SeparatorProps) {
  return <SeparatorItem {...props} isDisabled />;
}

export const tabViewActionVariants = cva('cursor-pointer outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring/45', {
  variants: {
    variant: {
      bar: 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 leading-[normal] [font-family:inherit] text-tertiary-foreground data-pressed:opacity-60',
      rail: 'bl-btn mx-1.5 flex flex-col items-center justify-center gap-[3px] rounded-[12px] border-0 bg-transparent px-1 pt-[7px] pb-1.5 leading-[normal] [font-family:inherit] text-tertiary-foreground data-hovered:bg-secondary/60 data-pressed:bg-secondary',
      /** A dashed tile ("Add workspace") that rounds its corners on hover and dips on press. */
      workspace: 'grid size-[34px] shrink-0 place-items-center rounded-[17px] border border-dashed border-border bg-transparent text-tertiary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] data-hovered:rounded-[11px] data-hovered:text-muted-foreground data-pressed:scale-[.94] motion-reduce:transition-none',
      plain: 'bl-btn border-0 bg-transparent p-0 [font-family:inherit]',
    },
  },
  defaultVariants: { variant: 'plain' },
});

export interface TabViewActionProps extends AriaButtonProps {
  icon?: string;
  title?: ReactNode;
}
/** A button that sits in the bar but isn't a tab ("Add server", "Compose"). */
export function TabViewAction({ className, icon, title, children, onPress, ...props }: TabViewActionProps) {
  const { variant } = useContext(TabViewCtx);
  return (
    <AriaButton
      data-slot="tab-view-action"
      onPress={onPress}
      className={composeRenderProps(className, (cls) => cn(tabViewActionVariants({ variant }), cls))}
      {...props}
    >
      {children ?? (
        <>
          {icon && <Icon name={icon} size={variant === 'bar' ? 25 : variant === 'workspace' ? 14 : 24} sw={variant === 'workspace' ? 1.9 : 1.8} />}
          {title != null && <span className={cn('font-semibold tracking-[.1px]', variant === 'bar' ? 'text-[10px]' : 'text-[10.5px]')}>{title}</span>}
        </>
      )}
    </AriaButton>
  );
}

interface SlotProps { className?: string; style?: CSSProperties; children?: ReactNode }
/** Content above/before the tabs (logo, title). */
export function TabViewHeader({ className, style, children }: SlotProps) {
  return <div data-slot="tab-view-header" className={cn('flex shrink-0 items-center justify-center', className)} style={style}>{children}</div>;
}
/** Content after the tabs, pushed to the far end of the bar — in a `workspace` bar it follows the list instead
 *  (Discord's add button sits right under the last tile), and the list scrolls once they no longer fit. */
export function TabViewFooter({ className, style, children }: SlotProps) {
  const { orientation, variant } = useContext(TabViewCtx);
  return (
    <div data-slot="tab-view-footer"
      className={cn('flex shrink-0 items-center justify-center',
        orientation === 'vertical' ? cn('flex-col', variant === 'workspace' ? 'gap-[8px]' : 'mt-auto') : 'ms-auto', className)}
      style={style}>{children}</div>
  );
}

/* ── Panels ── */
export function TabViewPanels<T extends object>({ className, ...props }: AriaTabPanelsProps<T>) {
  // Rendered before a (nested) tablist: leave a box-less placeholder here and let the outlet, which renders
  // after the tablist, draw the panels into it. Decided on the first real render; the tree order is fixed.
  const store = useContext(PanelsOutletCtx);
  const state = useContext(TabListStateContext);
  const mode = useRef<'direct' | 'outlet' | null>(null);
  if (!mode.current && state) mode.current = store && !store.seen.has(state) ? 'outlet' : 'direct';
  const outlet = mode.current === 'outlet';
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const panels = <AriaTabPanels data-slot="tab-view-panels" className={cn('relative min-h-0 min-w-0 flex-1', className)} {...props} />;
  useLayoutEffect(() => { if (outlet) store?.set(panels, host); });
  useLayoutEffect(() => () => { if (mode.current === 'outlet') store?.set(null, null); }, [store]);
  if (outlet) return <div ref={setHost} data-slot="tab-view-panels-placeholder" className="contents" />;
  return <AriaTabPanels data-slot="tab-view-panels" className={cn('relative min-h-0 min-w-0 flex-1', className)} {...props} />;
}

/** Panels move with the selection: the new one arrives from the side (or, vertically, the end) of the tab you
    picked while the old one leaves the other way, both on the tab-change spring. */
export function TabViewPanel({ className, style, ...props }: AriaTabPanelProps) {
  const { orientation } = useContext(TabViewCtx);
  const dir = useTabPanelDirection(orientation);
  return (
    <AriaTabPanel
      data-slot="tab-view-panel"
      className={composeRenderProps(className, (cls) =>
        cn(
          'absolute inset-0 overflow-auto outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring/45 data-focus-visible:ring-inset data-inert:not-data-exiting:hidden',
          'data-entering:animate-bl-panel-in data-exiting:pointer-events-none data-exiting:animate-bl-panel-out motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out',
          cls,
        ))}
      style={composeRenderProps(style, (st) => ({ ...dir, ...st }))}
      {...props}
    />
  );
}

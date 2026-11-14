'use client';
import { Children, createContext, isValidElement, useContext, useMemo, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import type { TabsTabState } from '@ui-sdk/core/tabs';
import { Button as SdkButton } from '@ui-sdk/react/button';
import {
  Tabs as SdkTabs,
  TabsIndicator as SdkTabsIndicator,
  TabsList as SdkTabsList,
  TabsPanel as SdkTabsPanel,
  TabsTab as SdkTabsTab,
  TabsTabIcon as SdkTabsTabIcon,
} from '@ui-sdk/react/tabs';
import { cva } from 'class-variance-authority';
import { Icon, type IconName } from '@/lib/icon';
import { barSurface } from '@/lib/primitives';
import { useChromeHidden } from '@/lib/theme';
import { cn, cx } from '@/lib/utils';
import { Separator, type SeparatorProps } from '@/components/ui/separator';
import { segmentIndicatorVariants, segmentItemVariants, segmentTrackVariants } from '@/components/ui/segmented';

/* ══ Tabs — UI SDK's Tabs, from an in-page segmented control to an app's tab bar ══
   One root, one family of parts. `variant` picks the look and `side` where the tabs sit around the panels
   (`top`/`bottom` lay the tabs out in a row, `start`/`end` in a column, and the arrow keys follow).

   In-page looks (the list draws its own sliding indicator):
     <Tabs defaultValue="a">                                    segmented (default) | underline
       <TabsList aria-label="Settings"><TabsTab value="a">Account</TabsTab>…</TabsList>
       <TabsPanel value="a">…</TabsPanel>                       a bare panel flows with the page
     </Tabs>

   Bar looks (a surface around the list, with parts that aren't tabs):
     <Tabs variant="bar" defaultValue="home">                   bar (bottom) | rail (start) | workspace (start) | plain
       <TabsBar>                                                the surface; `bar` hides with the scroll
         <TabsHeader>…</TabsHeader>                             logos, titles
         <TabsList aria-label="Sections">
           <TabsTab value="home" icon="house">Home</TabsTab>    icon over label; a function child draws it all
           <TabsSeparator />                                    decorative: the keyboard passes over it
           <TabsIndicator />                                    opt-in mark that slides to the selected tab
         </TabsList>
         <TabsAction icon="plus" aria-label="Add" />            a button, not a tab
         <TabsFooter>…</TabsFooter>
       </TabsBar>
       <TabsPanels><TabsPanel value="home">…</TabsPanel></TabsPanels>   panels in TabsPanels stack and cross-fade
     </Tabs>

   UI SDK owns the behavior: one tab stop, arrow keys that move and select (`activation="manual"` waits for Enter or
   Space), `value` / `onValueChange(value, details)`, and panels that unmount unless `keepMounted`. The bar and the
   panels may be written either way round: a bar (or a list) that is a direct child and comes after the panels is
   laid out ahead of them, so `side` still says where it sits. A tab is UI SDK's `button`; `render` makes it anything
   else (a link, or a `div` for a tab that holds controls of its own). ══ */
export { createTabsController } from '@ui-sdk/react/tabs';
export type { TabsController, TabsTabState, TabsValueChangeReason } from '@ui-sdk/core/tabs';

export type TabsVariant = 'segmented' | 'underline' | 'bar' | 'rail' | 'workspace' | 'plain';
export type TabsSide = 'top' | 'bottom' | 'start' | 'end';
export type TabsOrientation = 'horizontal' | 'vertical';

/** Where each look sits when `side` isn't given. */
const DEFAULT_SIDE: Record<TabsVariant, TabsSide> = {
  segmented: 'top',
  underline: 'top',
  plain: 'top',
  bar: 'bottom',
  rail: 'start',
  workspace: 'start',
};

interface TabsContextValue {
  variant: TabsVariant;
  side: TabsSide;
  orientation: TabsOrientation;
}
const TabsContext = createContext<TabsContextValue | null>(null);
const FALLBACK: TabsContextValue = { variant: 'segmented', side: 'top', orientation: 'horizontal' };
const useTabsContext = () => useContext(TabsContext) ?? FALLBACK;

/** The enclosing `Tabs`' look, side and orientation; `null` outside a `Tabs`. */
export const useTabs = () => useContext(TabsContext);

const TabsTabContext = createContext<TabsTabState | null>(null);
/** Inside a `TabsTab`: its state (`selected`, `disabled`), for content that styles itself from it; `null` outside. */
export const useTabsTab = () => useContext(TabsTabContext);

const PanelsContext = createContext(false);

/* ── Root ── */
export const tabsVariants = cva(
  'flex min-h-0 min-w-0 [&>[data-slot=tabs-panels]~[data-slot=tabs-bar]]:-order-1 [&>[data-slot=tabs-panels]~[data-slot=tabs-list]]:-order-1 [&>[data-slot=tabs-panel]~[data-slot=tabs-list]]:-order-1',
  {
    variants: {
      side: {
        top: 'flex-col',
        bottom: 'flex-col-reverse',
        start: 'flex-row',
        end: 'flex-row-reverse',
      },
      variant: {
        segmented: 'gap-4',
        underline: 'gap-4',
        bar: '',
        rail: '',
        workspace: '',
        plain: '',
      },
    },
    defaultVariants: { side: 'top', variant: 'segmented' },
  },
);

export type TabsProps<T extends string = string> = Omit<Parameters<typeof SdkTabs<T>>[0], 'orientation'> & {
  /** The look. `segmented` and `underline` are in-page tabs; `bar`, `rail`, `workspace` and `plain` put the list on a
   *  `TabsBar`. Default `segmented`. */
  variant?: TabsVariant;
  /** Where the tabs sit around the panels; it sets the orientation (`top`/`bottom` → horizontal, `start`/`end` →
   *  vertical). Defaults to `bottom` for `bar`, `start` for `rail` and `workspace`, `top` otherwise. */
  side?: TabsSide;
};

export function Tabs<T extends string = string>({ variant = 'segmented', side, className, ...props }: TabsProps<T>) {
  const at = side ?? DEFAULT_SIDE[variant];
  const orientation: TabsOrientation = at === 'start' || at === 'end' ? 'vertical' : 'horizontal';
  const context = useMemo(() => ({ variant, side: at, orientation }), [variant, at, orientation]);
  return (
    <TabsContext.Provider value={context}>
      <SdkTabs<T>
        data-variant={variant}
        data-side={at}
        orientation={orientation}
        className={cx(tabsVariants({ side: at, variant }), className)}
        {...props}
      />
    </TabsContext.Provider>
  );
}

/* ── Bar: the surface the list sits on ── */

const inline = 'flex shrink-0 data-[orientation=vertical]:flex-col';

export const tabsBarVariants = cva('box-border', {
  variants: {
    variant: {
      segmented: inline,
      underline: inline,
      /** iOS tab bar: translucent, pinned over the bottom of the content (the top with `side="top"`), hides with the scroll. */
      bar: cn(
        'absolute inset-x-0 bottom-0 z-120 flex data-[side=top]:top-0 data-[side=top]:bottom-auto transition-transform duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
        barSurface,
      ),
      /** Side rail: icons over labels. */
      rail: 'relative flex w-19 shrink-0 flex-col gap-1 bg-bar py-2 data-[side=end]:border-s data-[side=start]:border-e border-border',
      /** Workspace switcher (Discord, Slack): a narrow column of tiles on the muted surface. Header and footer stay
       *  put; the list between them scrolls when there are more tiles than room. */
      workspace: 'flex w-13 shrink-0 flex-col items-center gap-2 border-e border-border bg-muted px-0 py-2.5',
      /** No chrome: the host styles the bar. */
      plain: inline,
    },
  },
  defaultVariants: { variant: 'plain' },
});

export type TabsBarProps = ComponentProps<'div'> & {
  /** `bar` only: follow the kit's scroll chrome (scrolling down hides the bar, scrolling up shows it). Default true. */
  hideOnScroll?: boolean;
};

/** The surface around the list and the parts that aren't tabs. Its look is the root's `variant`. */
export function TabsBar({ hideOnScroll = true, className, ...props }: TabsBarProps) {
  const { variant, side, orientation } = useTabsContext();
  const hidden = useChromeHidden() && hideOnScroll && variant === 'bar';
  return (
    <div
      data-slot="tabs-bar"
      data-variant={variant}
      data-side={side}
      data-orientation={orientation}
      data-hidden={hidden ? '' : undefined}
      {...props}
      className={cn(tabsBarVariants({ variant }), hidden && (side === 'top' ? '-translate-y-full' : 'translate-y-full'), className)}
    />
  );
}

/* ── List ── */
export const tabsListVariants = cva('relative outline-none', {
  variants: {
    variant: {
      segmented: cn('flex', segmentTrackVariants()),
      underline:
        'isolate flex gap-5 shadow-hairline-b data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-0 data-[orientation=vertical]:border-e data-[orientation=vertical]:border-border data-[orientation=vertical]:shadow-none',
      bar: 'flex flex-1',
      rail: 'flex flex-col gap-1 px-1.5',
      // Scrolls on its own; the padding (cancelled by the margin) keeps badges and focus rings from being clipped.
      workspace:
        'flex min-h-0 w-full flex-col items-center gap-2 overflow-y-auto overscroll-contain -mt-1 -mb-1.5 pt-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      plain: 'flex data-[orientation=vertical]:flex-col',
    },
  },
  defaultVariants: { variant: 'segmented' },
});

export type TabsListProps = ComponentProps<typeof SdkTabsList>;

/** Looks that draw their indicator unless the list has a `TabsIndicator` of its own. */
const DRAWS_INDICATOR: ReadonlySet<TabsVariant> = new Set(['segmented', 'underline']);
const hasIndicator = (children: ReactNode) =>
  Children.toArray(children).some((child) => isValidElement(child) && child.type === TabsIndicator);

/** The tablist. `segmented` and `underline` add their sliding indicator; give the list a `TabsIndicator` child to
 *  style it, or to add one to the other looks. */
export function TabsList({ className, children, ...props }: TabsListProps) {
  const { variant } = useTabsContext();
  const draw = DRAWS_INDICATOR.has(variant);
  return (
    <SdkTabsList className={cx(tabsListVariants({ variant }), className)} {...props}>
      {typeof children === 'function'
        ? (state) => {
            const own = children(state);
            return <>{own}{draw && !hasIndicator(own) && <TabsIndicator />}</>;
          }
        : <>{children}{draw && !hasIndicator(children) && <TabsIndicator />}</>}
    </SdkTabsList>
  );
}

/* ── Tab ── */
const label = 'text-muted-foreground transition-[color] duration-spring-snappy ease-spring-snappy';

export const tabsTabVariants = cva(
  'group/tab relative box-border cursor-pointer border-0 bg-transparent [font-family:inherit] outline-none data-disabled:cursor-default',
  {
    variants: {
      variant: {
        segmented: segmentItemVariants(),
        underline: cn(
          'bl-btn -mb-px flex h-10 items-center justify-center gap-1.5 px-0.5 py-0 text-subhead leading-[inherit] font-semibold whitespace-nowrap hover:not-data-selected:not-data-disabled:text-foreground data-selected:text-primary focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/45 data-disabled:opacity-40',
          'data-[orientation=vertical]:mb-0 data-[orientation=vertical]:h-9 data-[orientation=vertical]:justify-start data-[orientation=vertical]:px-3',
          label,
        ),
        bar: cn(
          'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] p-0 text-center leading-[normal] data-selected:text-primary focus-visible:rounded-panel focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset data-disabled:opacity-40',
          label,
        ),
        rail: cn(
          'bl-btn flex flex-col items-center justify-center gap-[3px] rounded-panel px-1 pt-[7px] pb-1.5 text-center leading-[normal] hover:not-data-selected:not-data-disabled:bg-secondary/60 hover:not-data-selected:not-data-disabled:text-foreground active:not-data-selected:not-data-disabled:bg-secondary data-selected:bg-primary/12 data-selected:text-primary focus-visible:ring-2 focus-visible:ring-ring/45 data-disabled:opacity-40',
          label,
          'transition-[color,background-color]',
        ),
        /** A full-width row that centers its tile; the tile styles itself from the tab's state (`group-data-selected:`,
         *  `group-hover:`). On touch the row's hit area grows to 44px. */
        workspace:
          'group flex w-full shrink-0 justify-center p-0 text-inherit pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5',
        plain: 'p-0 text-inherit',
      },
    },
    defaultVariants: { variant: 'segmented' },
  },
);

const ICON_SIZE: Partial<Record<TabsVariant, number>> = { bar: 25, rail: 24 };
const STACKED: ReadonlySet<TabsVariant> = new Set(['bar', 'rail']);

/** An `icon` prop: a glyph name from `Icon`, or any node. */
function TabsGlyph({ icon, selected, size }: { icon: IconName | ReactNode; selected: boolean; size: number }) {
  return typeof icon === 'string'
    ? <Icon name={icon} size={size} sw={selected ? 2.1 : 1.8} />
    : <>{icon}</>;
}

export type TabsTabProps = ComponentProps<typeof SdkTabsTab> & {
  /** A glyph name (see `Icon`) or a node. In `bar` and `rail` it sits over the label, elsewhere before it. It is
   *  decorative; a tab with no text needs an `aria-label`. */
  icon?: IconName | ReactNode;
};

/** A tab. Its children are the label; `icon` adds a glyph. A function child gets the tab's state (`selected`,
 *  `disabled`) and draws the whole tab itself. */
export function TabsTab({ className, icon, children, ...props }: TabsTabProps) {
  const { variant } = useTabsContext();
  const stacked = STACKED.has(variant);
  return (
    <SdkTabsTab className={cx(tabsTabVariants({ variant }), className)} {...props}>
      {(state) => (
        <TabsTabContext.Provider value={state}>
          {typeof children === 'function' ? children(state) : (
            <>
              {icon != null && (
                <TabsTabIcon>
                  <TabsGlyph icon={icon} selected={state.selected} size={ICON_SIZE[variant] ?? 16} />
                </TabsTabIcon>
              )}
              {stacked && children != null ? <span className="text-caption2 font-semibold">{children}</span> : children}
            </>
          )}
        </TabsTabContext.Provider>
      )}
    </SdkTabsTab>
  );
}

export type TabsTabIconProps = ComponentProps<typeof SdkTabsTabIcon>;

/** A decorative icon inside a tab: out of its accessible name, and flipped in right-to-left text with `mirror`. */
export function TabsTabIcon({ className, ...props }: TabsTabIconProps) {
  return <SdkTabsTabIcon className={cx('flex shrink-0', className)} {...props} />;
}

/* ── Indicator ──
   One mark for the whole list, in a frame UI SDK keeps over the selected tab (`--active-tab-*`): the frame slides
   and resizes on the smooth spring, and the mark is placed inside it as if it sat in that tab. Its first placement
   doesn't animate. */
const indicatorFrame =
  'pointer-events-none absolute top-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) transition-[translate,width,height] duration-spring-smooth ease-spring-smooth data-[activation-direction=none]:transition-none motion-reduce:transition-none';

export const tabsIndicatorVariants = cva('absolute', {
  variants: {
    variant: {
      /** The card under the selected segment. */
      segmented: cn('inset-0', segmentIndicatorVariants()),
      /** A 2px tint line along the selected tab's edge (bottom; the end edge in a column). */
      underline: 'bg-primary',
      bar: 'bg-primary',
      rail: 'bg-primary',
      workspace: 'bg-primary',
      plain: 'bg-primary',
    },
    orientation: { horizontal: '', vertical: '' },
  },
  compoundVariants: [
    { variant: 'underline', orientation: 'horizontal', className: 'inset-x-0 bottom-0 h-0.5' },
    { variant: 'underline', orientation: 'vertical', className: 'inset-y-1 end-0 w-0.5 rounded-full' },
    { variant: ['bar', 'rail', 'workspace', 'plain'], orientation: 'horizontal', className: 'inset-x-3 bottom-0 h-0.5 rounded-full' },
    { variant: ['bar', 'rail', 'workspace', 'plain'], orientation: 'vertical', className: 'inset-y-2.5 start-0 w-[3px] rounded-e-full' },
  ],
  defaultVariants: { variant: 'segmented', orientation: 'horizontal' },
});

export interface TabsIndicatorProps extends Omit<ComponentProps<typeof SdkTabsIndicator>, 'className' | 'style' | 'children'> {
  /** Classes for the mark. Its box is the selected tab's, so `inset-x-2.5` or `-start-1.5` place it against that tab. */
  className?: string;
  style?: CSSProperties;
}

/** The selection mark, once, as a direct child of `TabsList`. `segmented` and `underline` draw one by default. */
export function TabsIndicator({ className, style, ...props }: TabsIndicatorProps) {
  const { variant, orientation } = useTabsContext();
  return (
    <SdkTabsIndicator className={cn(indicatorFrame, variant === 'segmented' && '-z-1')} {...props}>
      <span className={cn(tabsIndicatorVariants({ variant, orientation }), className)} style={style} />
    </SdkTabsIndicator>
  );
}

/* ── Pill ──
   The Discord pill on a tab's leading edge: a nub for `attention`, taller while the tab is hovered, full when it is
   selected. Unlike the indicator it doesn't travel: every tab has its own. */
export const tabsPillVariants = cva(
  'pointer-events-none absolute start-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-e-sm bg-foreground opacity-0 transition-[height,opacity] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none data-attention:h-1.5 data-attention:opacity-100 group-hover/tab:not-data-selected:h-3.5 group-hover/tab:not-data-selected:opacity-100 data-selected:h-7 data-selected:opacity-100',
);

export interface TabsPillProps extends ComponentProps<'span'> {
  /** Show the small unread nub while the tab is neither hovered nor selected. */
  attention?: boolean;
}

/** Goes inside a `TabsTab`. */
export function TabsPill({ attention, className, ...props }: TabsPillProps) {
  const { variant } = useTabsContext();
  const tab = useContext(TabsTabContext);
  return (
    <span
      data-slot="tabs-pill"
      aria-hidden
      {...props}
      data-selected={tab?.selected ? '' : undefined}
      data-attention={attention && !tab?.selected ? '' : undefined}
      className={cn(
        tabsPillVariants(),
        // The workspace pill grows on the bouncy spring, with the tile's corners.
        variant === 'workspace' && 'duration-(--duration-spring-bouncy) ease-(--ease-spring-bouncy)',
        className,
      )}
    />
  );
}

/* ── Parts that aren't tabs ── */

export type TabsSeparatorProps = Omit<SeparatorProps, 'orientation' | 'decorative'>;

/** A divider between tabs. It is decorative (a tablist holds only tabs), so arrow keys pass over it. */
export function TabsSeparator({ className, ...props }: TabsSeparatorProps) {
  const { orientation, variant } = useTabsContext();
  return (
    <Separator
      decorative
      orientation={orientation === 'vertical' ? 'horizontal' : 'vertical'}
      className={cx(
        cn('self-center', variant === 'workspace' ? 'my-[-1px] h-0.5 w-5 rounded-full' : orientation === 'vertical' ? 'h-px w-8' : 'h-6 w-px'),
        className,
      )}
      {...props}
    />
  );
}

export const tabsActionVariants = cva('cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40', {
  variants: {
    variant: {
      segmented: 'bl-btn border-0 bg-transparent p-0 [font-family:inherit] text-muted-foreground hover:not-data-disabled:text-foreground',
      underline: 'bl-btn border-0 bg-transparent p-0 [font-family:inherit] text-muted-foreground hover:not-data-disabled:text-foreground',
      bar: 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 leading-[normal] [font-family:inherit] text-muted-foreground active:not-data-disabled:opacity-60',
      rail: 'bl-btn mx-1.5 flex flex-col items-center justify-center gap-[3px] rounded-panel border-0 bg-transparent px-1 pt-[7px] pb-1.5 leading-[normal] [font-family:inherit] text-muted-foreground hover:not-data-disabled:bg-secondary/60 hover:not-data-disabled:text-foreground active:not-data-disabled:bg-secondary',
      /** A dashed tile ("Add workspace") that rounds its corners on hover and dips on press; 44px to a finger. */
      workspace:
        'relative grid size-[34px] shrink-0 place-items-center rounded-[17px] border border-dashed border-border bg-transparent text-muted-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] hover:not-data-disabled:rounded-[11px] hover:not-data-disabled:text-foreground active:not-data-disabled:scale-[.94] motion-reduce:transition-none pointer-coarse:after:absolute pointer-coarse:after:-inset-[5px]',
      plain: 'bl-btn border-0 bg-transparent p-0 [font-family:inherit]',
    },
  },
  defaultVariants: { variant: 'plain' },
});

export type TabsActionProps = ComponentProps<typeof SdkButton> & {
  /** A glyph name (see `Icon`) or a node; with no text, give the action an `aria-label`. */
  icon?: IconName | ReactNode;
};

/** A button that sits in the bar but isn't a tab ("Add server", "Compose"). Children are its label. */
export function TabsAction({ className, icon, children, ...props }: TabsActionProps) {
  const { variant } = useTabsContext();
  const size = variant === 'bar' ? 25 : variant === 'workspace' ? 14 : variant === 'rail' ? 24 : 16;
  return (
    <SdkButton className={cx(tabsActionVariants({ variant }), className)} {...props}>
      {typeof children === 'function' ? children : (
        <>
          {icon != null && (typeof icon === 'string' ? <Icon name={icon} size={size} sw={variant === 'workspace' ? 1.9 : 1.8} /> : icon)}
          {children != null && (STACKED.has(variant) ? <span className="text-caption2 font-semibold">{children}</span> : children)}
        </>
      )}
    </SdkButton>
  );
}

export type TabsHeaderProps = ComponentProps<'div'>;

/** Content before the tabs in a bar (logo, title). */
export function TabsHeader({ className, ...props }: TabsHeaderProps) {
  return <div data-slot="tabs-header" {...props} className={cn('flex shrink-0 items-center justify-center', className)} />;
}

export type TabsFooterProps = ComponentProps<'div'>;

/** Content after the tabs, pushed to the far end of the bar. In a `workspace` bar it follows the list instead
 *  (Discord's add button sits right under the last tile), and the list scrolls once they no longer fit. */
export function TabsFooter({ className, ...props }: TabsFooterProps) {
  const { orientation, variant } = useTabsContext();
  return (
    <div
      data-slot="tabs-footer"
      {...props}
      className={cn(
        'flex shrink-0 items-center justify-center',
        orientation === 'vertical' ? cn('flex-col', variant === 'workspace' ? 'gap-2' : 'mt-auto') : 'ms-auto',
        className,
      )}
    />
  );
}

/* ── Panels ── */

/** A panel that arrives with the selection: UI SDK marks its first frame (`data-starting-style`) and says which way
    the selection moved (`data-activation-direction`), so it fades in from the side of the tab that was picked.
    Under reduced motion it only fades. */
const panelEnter =
  'transition-[opacity,translate] duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 motion-safe:data-[activation-direction=right]:data-starting-style:translate-x-7 motion-safe:data-[activation-direction=left]:data-starting-style:-translate-x-7 motion-safe:data-[activation-direction=down]:data-starting-style:translate-y-7 motion-safe:data-[activation-direction=up]:data-starting-style:-translate-y-7';

/** …and, stacked, the one that was showing leaves the other way, mounted until it is gone. */
const panelExit =
  'data-ending-style:opacity-0 data-ending-style:duration-(--duration-exit-tray) data-ending-style:ease-exit motion-reduce:data-ending-style:duration-exit motion-safe:data-[activation-direction=right]:data-ending-style:-translate-x-7 motion-safe:data-[activation-direction=left]:data-ending-style:translate-x-7 motion-safe:data-[activation-direction=down]:data-ending-style:-translate-y-7 motion-safe:data-[activation-direction=up]:data-ending-style:translate-y-7';

export type TabsPanelsProps = ComponentProps<'div'>;

/** The box the panels share: in it they stack, so one can leave while the next arrives. It fills the space the bar
 *  leaves. */
export function TabsPanels({ className, ...props }: TabsPanelsProps) {
  return (
    <PanelsContext.Provider value>
      <div data-slot="tabs-panels" {...props} className={cn('relative min-h-0 min-w-0 flex-1', className)} />
    </PanelsContext.Provider>
  );
}

export type TabsPanelProps = ComponentProps<typeof SdkTabsPanel>;

/** A tab's content. A bare panel sits in the flow: the one that was showing leaves at once. Inside `TabsPanels` the
 *  panels stack and scroll on their own, and the old one slides out while the new one slides in. */
export function TabsPanel({ className, ...props }: TabsPanelProps) {
  const stacked = useContext(PanelsContext);
  return (
    <SdkTabsPanel
      className={cx(
        stacked
          ? ['absolute inset-0 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset not-data-selected:pointer-events-none', panelEnter, panelExit]
          : ['rounded-card outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 data-ending-style:hidden', panelEnter],
        className,
      )}
      {...props}
    />
  );
}

'use client';
import { createContext, useContext, type ComponentProps, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import type { TabsTabState } from '@ui-sdk/core/tabs';
import { Button as SdkButton } from '@ui-sdk/react/button';
import {
  Tabs as SdkTabs,
  TabsIndicator as SdkTabsIndicator,
  TabsList as SdkTabsList,
  TabsPanel as SdkTabsPanel,
  TabsTab as SdkTabsTab,
} from '@ui-sdk/react/tabs';
import { cva } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { useChromeHidden } from '@/lib/theme';
import { cn, cx } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { tabsPanelEnter } from '@/components/ui/tabs';

/* ══ TabView — a compositional tab container on UI SDK's Tabs.

   <TabView placement="start">                 root: selection, orientation, where the bar sits
     <TabViewBar>                              the bar's surface (iOS bar / side rail / workspace rail / plain)
       <TabViewHeader>…</TabViewHeader>         anything that isn't a tab: logos, titles
       <TabViewList aria-label="Sections">     the tablist — arrow keys follow the orientation
         <TabViewTab value="a" icon="person" title="Contacts" />
         <TabViewSeparator />                  decorative, so the keyboard never lands on it
         <TabViewTab value="b">{({ selected }) => …}</TabViewTab>   fully custom tab
         <TabViewIndicator />                  one mark that slides to the selected tab
       </TabViewList>
       <TabViewAction aria-label="Add">…</TabViewAction>           a button, not a tab
       <TabViewFooter>…</TabViewFooter>
     </TabViewBar>
     <TabViewPanels><TabViewPanel value="a">…</TabViewPanel>…</TabViewPanels>
   </TabView>

   Placement `top`/`bottom` is horizontal, `start`/`end` vertical. The bar and the panels may be written either
   way round: a bar (or a bare list) that is a direct child and comes after the panels is laid out ahead of
   them, so `placement` still says where it sits (`data-bar-placement` on the root and the bar). A tab is UI SDK's
   `button`; `render` makes it anything else (a `div` for a tab that holds controls of its own). ══ */

export type TabViewPlacement = 'top' | 'bottom' | 'start' | 'end';
export type TabViewOrientation = 'horizontal' | 'vertical';
export type TabViewBarVariant = 'bar' | 'rail' | 'workspace' | 'plain';

interface TabViewCtxValue {
  orientation: TabViewOrientation;
  placement: TabViewPlacement;
  variant: TabViewBarVariant;
}
const TabViewCtx = createContext<TabViewCtxValue>({ orientation: 'horizontal', placement: 'bottom', variant: 'bar' });
/** The enclosing TabView's orientation, placement and bar variant. */
export const useTabView = () => useContext(TabViewCtx);

const TabItemCtx = createContext<TabsTabState | null>(null);
/** Inside a TabViewTab: its state (`selected`, `disabled`). */
export const useTabViewTab = () => useContext(TabItemCtx);

export const tabViewVariants = cva(
  'flex min-h-0 min-w-0 [&>[data-slot=tab-view-panels]~[data-slot=tab-view-bar]]:-order-1 [&>[data-slot=tab-view-panels]~[data-slot=tabs-list]]:-order-1',
  {
    variants: {
      placement: {
        top: 'flex-col',
        bottom: 'flex-col-reverse',
        start: 'flex-row',
        end: 'flex-row-reverse',
      },
    },
    defaultVariants: { placement: 'bottom' },
  },
);

export type TabViewProps<T extends string = string> = Parameters<typeof SdkTabs<T>>[0] & {
  /** Where the bar sits. `top`/`bottom` → horizontal, `start`/`end` → vertical (`orientation="vertical"` alone means `start`). */
  placement?: TabViewPlacement;
};

export function TabView<T extends string = string>({ placement, orientation, className, ...props }: TabViewProps<T>) {
  const place: TabViewPlacement = placement ?? (orientation === 'vertical' ? 'start' : 'bottom');
  const orient: TabViewOrientation = orientation ?? (place === 'start' || place === 'end' ? 'vertical' : 'horizontal');
  return (
    <TabViewCtx.Provider value={{ orientation: orient, placement: place, variant: orient === 'vertical' ? 'rail' : 'bar' }}>
      <SdkTabs<T>
        data-bar-placement={place}
        orientation={orient}
        className={cx(tabViewVariants({ placement: place }), className)}
        {...props}
      />
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
      rail: 'relative flex w-[76px] shrink-0 flex-col gap-1 bg-bar py-2 data-[bar-placement=end]:[border-left:1px_solid_var(--border)] data-[bar-placement=start]:[border-right:1px_solid_var(--border)]',
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
      <div data-slot="tab-view-bar" {...props} data-variant={v} data-orientation={ctx.orientation} data-bar-placement={ctx.placement}
        className={cn(tabViewBarVariants({ variant: v }), hid && 'translate-y-full', className)} style={style}>
        {children}
      </div>
    </TabViewCtx.Provider>
  );
}

/* ── List: the tablist ── */
export const tabViewListVariants = cva('relative outline-none', {
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

export type TabViewListProps = ComponentProps<typeof SdkTabsList>;

export function TabViewList({ className, ...props }: TabViewListProps) {
  const { variant } = useContext(TabViewCtx);
  return <SdkTabsList className={cx(tabViewListVariants({ variant }), className)} {...props} />;
}

/* ── Tab ── */
export const tabViewTabVariants = cva('group/tab relative cursor-pointer outline-none', {
  variants: {
    variant: {
      bar: 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 text-center leading-[normal] [font-family:inherit] text-tertiary-foreground transition-[color] duration-spring-snappy ease-spring-snappy data-selected:text-primary focus-visible:rounded-panel focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset',
      rail: 'bl-btn flex flex-col items-center justify-center gap-[3px] rounded-panel border-0 bg-transparent px-1 pt-[7px] pb-1.5 text-center [font-family:inherit] leading-[normal] text-tertiary-foreground transition-[color,background-color] duration-spring-snappy ease-spring-snappy hover:not-data-selected:not-data-disabled:bg-secondary/60 hover:not-data-selected:not-data-disabled:text-muted-foreground active:not-data-selected:not-data-disabled:bg-secondary data-selected:bg-primary/12 data-selected:text-primary focus-visible:ring-2 focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40',
      /** A full-width row that centers its tile; the tile styles itself from the tab's state (`group-data-selected:`, `group-hover:`). */
      workspace: 'group flex w-full shrink-0 justify-center border-0 bg-transparent p-0 [font-family:inherit] text-inherit data-disabled:cursor-default',
      plain: 'border-0 bg-transparent p-0 [font-family:inherit] text-inherit data-disabled:cursor-default',
    },
  },
  defaultVariants: { variant: 'plain' },
});

export type TabViewTabProps = Omit<ComponentProps<typeof SdkTabsTab>, 'title'> & {
  /** Default content: an icon name (see `Icon`)… */
  icon?: string;
  /** …and a label. Ignored when `children` is given. */
  title?: ReactNode;
};

/** A tab. `icon` + `title` draw the bar's default look; `children` (or a function of the tab's state) replace it.
    A tab whose content has no text, like an icon or a tile, needs an `aria-label`. */
export function TabViewTab({ className, icon, title, children, ...props }: TabViewTabProps) {
  const { variant } = useContext(TabViewCtx);
  return (
    <SdkTabsTab className={cx(tabViewTabVariants({ variant }), className)} {...props}>
      {(state) => (
        <TabItemCtx.Provider value={state}>
          {children != null
            ? typeof children === 'function' ? children(state) : children
            : <TabViewTabContent icon={icon} title={title} selected={state.selected} />}
        </TabItemCtx.Provider>
      )}
    </SdkTabsTab>
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
   One mark for the whole list, in a frame UI SDK keeps over the selected tab (`--active-tab-*`): the frame
   slides and resizes on the smooth spring, and the mark is placed inside it as if it sat in that tab — a
   bottom underline when horizontal, a leading bar when vertical. */
export const tabViewIndicatorVariants = cva('absolute bg-primary', {
  variants: {
    orientation: {
      horizontal: 'inset-x-3 bottom-0 h-[2px] rounded-full',
      vertical: 'start-0 inset-y-2.5 w-[3px] rounded-e-full',
    },
  },
  defaultVariants: { orientation: 'horizontal' },
});

export interface TabViewIndicatorProps extends Omit<ComponentProps<typeof SdkTabsIndicator>, 'className' | 'style' | 'children'> {
  /** Classes for the mark. Its box is the selected tab's, so `inset-x-2.5` or `-start-1.5` place it against that tab. */
  className?: string;
  style?: CSSProperties;
}

/** Goes inside the `TabViewList`, once. Its first placement doesn't animate. */
export function TabViewIndicator({ className, style, ...props }: TabViewIndicatorProps) {
  const { orientation } = useContext(TabViewCtx);
  return (
    <SdkTabsIndicator
      className="pointer-events-none absolute top-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) transition-[translate,width,height] duration-spring-smooth ease-spring-smooth data-[activation-direction=none]:transition-none motion-reduce:transition-none"
      {...props}
    >
      <span className={cn(tabViewIndicatorVariants({ orientation }), className)} style={style} />
    </SdkTabsIndicator>
  );
}

/* ── Pill ──
   The Discord pill on a tab's leading edge: a nub for `attention`, taller while the tab is hovered, full when
   it is selected. Unlike the indicator it doesn't travel: every tab has its own. */
export const tabViewPillVariants = cva(
  'pointer-events-none absolute start-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-e-[4px] bg-foreground opacity-0 transition-[height,opacity] duration-spring-snappy ease-spring-snappy data-attention:h-1.5 data-attention:opacity-100 group-hover/tab:not-data-selected:h-3.5 group-hover/tab:not-data-selected:opacity-100 data-selected:h-7 data-selected:opacity-100',
);

export interface TabViewPillProps extends ComponentProps<'span'> {
  /** Show the small unread nub while the tab is neither hovered nor selected. */
  attention?: boolean;
}

/** Goes inside a `TabViewTab`. */
export function TabViewPill({ attention, className, ...props }: TabViewPillProps) {
  const { variant } = useContext(TabViewCtx);
  const tab = useContext(TabItemCtx);
  return (
    <span data-slot="tab-view-pill" aria-hidden {...props}
      data-selected={tab?.selected ? '' : undefined}
      data-attention={attention && !tab?.selected ? '' : undefined}
      className={cn(
        tabViewPillVariants(),
        // The workspace pill grows on the bouncy spring, with the tile's corners.
        variant === 'workspace' && 'duration-(--duration-spring-bouncy) ease-(--ease-spring-bouncy)',
        className,
      )} />
  );
}

/* ── Non-tab parts ── */

export interface TabViewSeparatorProps { className?: string; style?: CSSProperties }
/** A divider between tabs. It is decorative (a tablist holds only tabs), so arrow keys pass over it. */
export function TabViewSeparator({ className, style }: TabViewSeparatorProps) {
  const { orientation, variant } = useContext(TabViewCtx);
  return (
    <Separator decorative orientation={orientation === 'vertical' ? 'horizontal' : 'vertical'}
      className={cn('self-center',
        variant === 'workspace' ? 'my-[-1px] h-[2px] w-[20px] rounded-full' : orientation === 'vertical' ? 'h-px w-8' : 'h-6 w-px',
        className)}
      style={style} />
  );
}

export const tabViewActionVariants = cva('cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/45', {
  variants: {
    variant: {
      bar: 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 leading-[normal] [font-family:inherit] text-tertiary-foreground active:not-data-disabled:opacity-60',
      rail: 'bl-btn mx-1.5 flex flex-col items-center justify-center gap-[3px] rounded-panel border-0 bg-transparent px-1 pt-[7px] pb-1.5 leading-[normal] [font-family:inherit] text-tertiary-foreground hover:not-data-disabled:bg-secondary/60 active:not-data-disabled:bg-secondary',
      /** A dashed tile ("Add workspace") that rounds its corners on hover and dips on press. */
      workspace: 'grid size-[34px] shrink-0 place-items-center rounded-[17px] border border-dashed border-border bg-transparent text-tertiary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] hover:not-data-disabled:rounded-[11px] hover:not-data-disabled:text-muted-foreground active:not-data-disabled:scale-[.94] motion-reduce:transition-none',
      plain: 'bl-btn border-0 bg-transparent p-0 [font-family:inherit]',
    },
  },
  defaultVariants: { variant: 'plain' },
});

export type TabViewActionProps = Omit<ComponentProps<typeof SdkButton>, 'title'> & {
  icon?: string;
  title?: ReactNode;
};
/** A button that sits in the bar but isn't a tab ("Add server", "Compose"). */
export function TabViewAction({ className, icon, title, children, ...props }: TabViewActionProps) {
  const { variant } = useContext(TabViewCtx);
  return (
    <SdkButton className={cx(tabViewActionVariants({ variant }), className)} {...props}>
      {children ?? (
        <>
          {icon && <Icon name={icon} size={variant === 'bar' ? 25 : variant === 'workspace' ? 14 : 24} sw={variant === 'workspace' ? 1.9 : 1.8} />}
          {title != null && <span className={cn('font-semibold tracking-[.1px]', variant === 'bar' ? 'text-[10px]' : 'text-[10.5px]')}>{title}</span>}
        </>
      )}
    </SdkButton>
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
/** The box the panels share: they stack in it, so one can leave while the next arrives. */
export function TabViewPanels({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="tab-view-panels" className={cn('relative min-h-0 min-w-0 flex-1', className)} {...props} />;
}

export type TabViewPanelProps = ComponentProps<typeof SdkTabsPanel>;

/** Panels move with the selection: the new one arrives from the side (or, vertically, the end) of the tab you
    picked while the old one leaves the other way (`data-ending-style`, which keeps it mounted until it is gone). */
export function TabViewPanel({ className, ...props }: TabViewPanelProps) {
  return (
    <SdkTabsPanel
      className={cx(
        [
          'absolute inset-0 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset not-data-selected:pointer-events-none',
          tabsPanelEnter,
          'data-ending-style:opacity-0 data-ending-style:duration-(--duration-exit-tray) data-ending-style:ease-exit motion-reduce:data-ending-style:duration-exit',
          'motion-safe:data-[activation-direction=right]:data-ending-style:-translate-x-[28px] motion-safe:data-[activation-direction=left]:data-ending-style:translate-x-[28px] motion-safe:data-[activation-direction=down]:data-ending-style:-translate-y-[28px] motion-safe:data-[activation-direction=up]:data-ending-style:translate-y-[28px]',
        ],
        className,
      )}
      {...props}
    />
  );
}

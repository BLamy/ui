import { createContext, useContext, useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import {
  Button as AriaButton, type ButtonProps as AriaButtonProps,
  SelectionIndicator,
  Tab as AriaTab, type TabProps as AriaTabProps, type TabRenderProps,
  TabList as AriaTabList, type TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel, type TabPanelProps as AriaTabPanelProps,
  TabPanels as AriaTabPanels, type TabPanelsProps as AriaTabPanelsProps,
  Tabs as AriaTabs, type TabsProps as AriaTabsProps,
  composeRenderProps, createLeafComponent,
  type Key,
} from 'react-aria-components';
import { cva } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { useChromeHidden } from '../lib/theme';
import { cn } from '../lib/utils';

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

   Placement `top`/`bottom` is horizontal, `start`/`end` vertical. One selection tick per user change. ══ */

export type TabViewPlacement = 'top' | 'bottom' | 'start' | 'end';
export type TabViewOrientation = 'horizontal' | 'vertical';
export type TabViewBarVariant = 'bar' | 'rail' | 'plain';

interface TabViewCtxValue {
  orientation: TabViewOrientation;
  placement: TabViewPlacement;
  variant: TabViewBarVariant;
}
const TabViewCtx = createContext<TabViewCtxValue>({ orientation: 'horizontal', placement: 'bottom', variant: 'bar' });
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

export function TabView({ placement, orientation, className, onSelectionChange, children, ...props }: TabViewProps) {
  const place: TabViewPlacement = placement ?? (orientation === 'vertical' ? 'start' : 'bottom');
  const orient: TabViewOrientation = orientation ?? (place === 'start' || place === 'end' ? 'vertical' : 'horizontal');
  // react-aria reports its automatic first selection too; only user changes tick.
  const last = useRef<Key | null>(props.selectedKey ?? props.defaultSelectedKey ?? null);
  return (
    <TabViewCtx.Provider value={{ orientation: orient, placement: place, variant: orient === 'vertical' ? 'rail' : 'bar' }}>
      <AriaTabs
        data-slot="tab-view"
        data-placement={place}
        orientation={orient}
        onSelectionChange={(key) => {
          if (last.current != null && key !== last.current) Haptics.selection();
          last.current = key;
          onSelectionChange?.(key);
        }}
        className={composeRenderProps(className, (cls) => cn(tabViewVariants({ placement: place }), cls))}
        {...props}
      >
        {children}
      </AriaTabs>
    </TabViewCtx.Provider>
  );
}

/* ── Bar: the surface the list sits on ── */
export const tabViewBarVariants = cva('box-border', {
  variants: {
    variant: {
      /** iOS bottom tab bar — translucent, pinned over the content, hides with the scroll. */
      bar: 'absolute inset-x-0 bottom-0 z-120 flex h-[62px] [border-top:1px_solid_var(--bl-sep)] bg-bl-bar pb-1 backdrop-blur-[20px] backdrop-saturate-[1.7] transition-transform duration-300 ease-ios',
      /** Vertical side rail — icons over labels. */
      rail: 'relative flex w-[76px] shrink-0 flex-col gap-1 bg-bl-bar py-2 data-[placement=end]:[border-left:1px_solid_var(--bl-sep)] data-[placement=start]:[border-right:1px_solid_var(--bl-sep)]',
      /** No chrome: the host styles the bar (see the Discord-style rail). */
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
      plain: 'flex data-[orientation=vertical]:flex-col',
    },
  },
  defaultVariants: { variant: 'plain' },
});

export function TabViewList<T extends object>({ className, ...props }: AriaTabListProps<T>) {
  const { variant } = useContext(TabViewCtx);
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
      bar: 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 text-center leading-[normal] [font-family:inherit] text-bl-label3 transition-[color] duration-150 data-selected:text-primary data-focus-visible:rounded-[12px] data-focus-visible:ring-2 data-focus-visible:ring-ring/45 data-focus-visible:ring-inset',
      rail: 'bl-btn flex flex-col items-center justify-center gap-[3px] rounded-[12px] px-1 pt-[7px] pb-1.5 text-center leading-[normal] text-bl-label3 transition-[color,background-color] duration-150 ease-ios data-hovered:bg-bl-fill/60 data-hovered:text-bl-label2 data-pressed:bg-bl-fill data-selected:bg-primary/12 data-selected:text-primary data-focus-visible:ring-2 data-focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40',
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
      bar: 'bg-primary transition-[translate,width,height] duration-300 ease-ios motion-reduce:transition-none',
      pill: 'start-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-e-[4px] bg-foreground opacity-0 transition-[height,opacity] duration-200 ease-ios data-attention:h-1.5 data-attention:opacity-100 data-hovered:h-3.5 data-hovered:opacity-100 data-selected:h-7 data-selected:opacity-100',
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
  const { orientation } = useContext(TabViewCtx);
  const tab = useContext(TabItemCtx);
  const cls = cn(tabViewIndicatorVariants({ variant, orientation }), className);
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
  const { orientation } = useContext(TabViewCtx);
  return (
    <div ref={ref as never} role="presentation" data-slot="tab-view-separator" data-orientation={orientation}
      className={cn('shrink-0 self-center bg-bl-sep', orientation === 'vertical' ? 'h-px w-8' : 'h-6 w-px', props.className)}
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
      bar: 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 leading-[normal] [font-family:inherit] text-bl-label3 data-pressed:opacity-60',
      rail: 'bl-btn mx-1.5 flex flex-col items-center justify-center gap-[3px] rounded-[12px] border-0 bg-transparent px-1 pt-[7px] pb-1.5 leading-[normal] [font-family:inherit] text-bl-label3 data-hovered:bg-bl-fill/60 data-pressed:bg-bl-fill',
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
          {icon && <Icon name={icon} size={variant === 'bar' ? 25 : 24} sw={1.8} />}
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
/** Content after the tabs, pushed to the far end of the bar. */
export function TabViewFooter({ className, style, children }: SlotProps) {
  const { orientation } = useContext(TabViewCtx);
  return (
    <div data-slot="tab-view-footer"
      className={cn('flex shrink-0 items-center justify-center', orientation === 'vertical' ? 'mt-auto flex-col' : 'ms-auto', className)}
      style={style}>{children}</div>
  );
}

/* ── Panels ── */
export function TabViewPanels<T extends object>({ className, ...props }: AriaTabPanelsProps<T>) {
  return <AriaTabPanels data-slot="tab-view-panels" className={cn('relative min-h-0 min-w-0 flex-1', className)} {...props} />;
}

export function TabViewPanel({ className, ...props }: AriaTabPanelProps) {
  return (
    <AriaTabPanel
      data-slot="tab-view-panel"
      className={composeRenderProps(className, (cls) =>
        cn('absolute inset-0 overflow-auto outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring/45 data-focus-visible:ring-inset data-inert:hidden', cls))}
      {...props}
    />
  );
}

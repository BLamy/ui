'use client';
import { createContext, useContext, type ComponentProps } from 'react';
import {
  Tabs as SdkTabs,
  TabsIndicator as SdkTabsIndicator,
  TabsList as SdkTabsList,
  TabsPanel as SdkTabsPanel,
  TabsTab as SdkTabsTab,
  TabsTabIcon as SdkTabsTabIcon,
} from '@ui-sdk/react/tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';

/* ══ Tabs — UI SDK's Tabs in the kit's two looks ══
   `segmented` is the iOS segmented control, `underline` a tinted bar under the labels. UI SDK owns the behavior: one
   tab stop, arrow keys that move and select (`activation="manual"` waits for Enter or Space), `value` /
   `onValueChange(value, details)`, and panels that unmount unless `keepMounted`. The list draws the selection
   indicator, one element that slides and resizes to the selected tab, and a panel arrives from the side of the tab
   that was picked. A tab is UI SDK's `button`; `render` makes it anything else (a link, or a `div` for a tab that holds
   controls of its own).
   <Tabs defaultValue="a">
     <TabsList aria-label="Settings"><TabsTab value="a">Account</TabsTab>…</TabsList>
     <TabsPanel value="a">…</TabsPanel>
   </Tabs> ══ */
export { createTabsController } from '@ui-sdk/react/tabs';
export type { TabsController, TabsValueChangeReason } from '@ui-sdk/core/tabs';

export const tabsListVariants = cva('relative isolate flex', {
  variants: {
    variant: {
      segmented: 'gap-0.5 rounded-[9px] bg-secondary p-0.5',
      underline: 'gap-5 shadow-hairline-b',
    },
  },
  defaultVariants: { variant: 'segmented' },
});

export const tabsTabVariants = cva(
  'bl-btn relative box-border flex cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent [font-family:inherit] leading-[inherit] font-semibold whitespace-nowrap outline-none transition-[color] duration-spring-snappy ease-spring-snappy data-disabled:cursor-default data-disabled:opacity-40',
  {
    variants: {
      variant: {
        segmented:
          'flex-1 rounded-[7px] px-3 py-[5px] text-footnote text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45',
        underline:
          '-mb-px h-10 px-0.5 py-0 text-subhead text-muted-foreground hover:not-data-selected:not-data-disabled:text-foreground data-selected:text-primary focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/45',
      },
    },
    defaultVariants: { variant: 'segmented' },
  },
);

/** The selection indicator: placed and sized from the selected tab's box (UI SDK's `--active-tab-*`), behind the
    labels (the list is `isolate`), so it slides and resizes between unequal tabs. Its first placement doesn't animate. */
export const tabsIndicatorVariants = cva(
  'absolute top-0 left-0 -z-1 w-(--active-tab-width) translate-x-(--active-tab-left) transition-[translate,width,height] duration-spring-smooth ease-spring-smooth data-[activation-direction=none]:transition-none motion-reduce:transition-none',
  {
    variants: {
      variant: {
        /** The card under the selected segment. */
        segmented: 'h-(--active-tab-height) translate-y-(--active-tab-top) rounded-[7px] bg-segment shadow-[0_1px_4px_black] shadow-black/14',
        /** A 2px tint bar along the selected tab's bottom edge. */
        underline: 'h-[2px] translate-y-[calc(var(--active-tab-top)+var(--active-tab-height)-100%)] bg-primary',
      },
    },
    defaultVariants: { variant: 'segmented' },
  },
);

/** A panel that arrives with the selection: UI SDK marks its first frame (`data-starting-style`) and says which way
    the selection moved (`data-activation-direction`), so it fades in from the side of the tab that was picked.
    Under reduced motion it only fades. */
export const tabsPanelEnter =
  'transition-[opacity,translate] duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 motion-safe:data-[activation-direction=right]:data-starting-style:translate-x-[28px] motion-safe:data-[activation-direction=left]:data-starting-style:-translate-x-[28px] motion-safe:data-[activation-direction=down]:data-starting-style:translate-y-[28px] motion-safe:data-[activation-direction=up]:data-starting-style:-translate-y-[28px]';

type TabsVariant = VariantProps<typeof tabsListVariants>['variant'];
const TabsCtx = createContext<TabsVariant>('segmented');

export type TabsProps<T extends string = string> = Parameters<typeof SdkTabs<T>>[0] & {
  variant?: TabsVariant;
};

export function Tabs<T extends string = string>({ className, variant = 'segmented', ...props }: TabsProps<T>) {
  return (
    <TabsCtx.Provider value={variant}>
      <SdkTabs<T> className={cx('flex flex-col gap-4 data-[orientation=vertical]:flex-row', className)} {...props} />
    </TabsCtx.Provider>
  );
}

export type TabsListProps = ComponentProps<typeof SdkTabsList>;

export function TabsList({ className, children, ...props }: TabsListProps) {
  const variant = useContext(TabsCtx);
  const indicator = <SdkTabsIndicator className={tabsIndicatorVariants({ variant })} />;
  return (
    <SdkTabsList className={cx(tabsListVariants({ variant }), className)} {...props}>
      {typeof children === 'function' ? (state) => <>{children(state)}{indicator}</> : <>{children}{indicator}</>}
    </SdkTabsList>
  );
}

export type TabsTabProps = ComponentProps<typeof SdkTabsTab>;

export function TabsTab({ className, ...props }: TabsTabProps) {
  const variant = useContext(TabsCtx);
  return <SdkTabsTab className={cx(tabsTabVariants({ variant }), className)} {...props} />;
}

export type TabsTabIconProps = ComponentProps<typeof SdkTabsTabIcon>;

/** A decorative icon inside a tab: out of its accessible name, and flipped in right-to-left text with `mirror`. */
export function TabsTabIcon({ className, ...props }: TabsTabIconProps) {
  return <SdkTabsTabIcon className={cx('flex shrink-0', className)} {...props} />;
}

export type TabsPanelProps = ComponentProps<typeof SdkTabsPanel>;

/** Panels sit in the flow, so the one that was showing leaves at once and the next arrives beside nothing. */
export function TabsPanel({ className, ...props }: TabsPanelProps) {
  return (
    <SdkTabsPanel
      className={cx(['rounded-card outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 data-ending-style:hidden', tabsPanelEnter], className)}
      {...props}
    />
  );
}

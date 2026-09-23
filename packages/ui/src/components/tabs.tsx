import { createContext, useContext, useRef } from 'react';
import type { Key } from 'react-aria-components';
import {
  Tab as AriaTab, type TabProps as AriaTabProps,
  TabList as AriaTabList, type TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel, type TabPanelProps as AriaTabPanelProps,
  Tabs as AriaTabs, type TabsProps as AriaTabsProps,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

/* ══ Tabs — react-aria's Tabs (arrow keys move, automatic activation). `segmented` is the iOS segmented look,
   `underline` a tinted underline bar. One selection tick per change. ══ */
export const tabsListVariants = cva('flex', {
  variants: {
    variant: {
      segmented: 'gap-0.5 rounded-[9px] bg-secondary p-0.5',
      underline: 'gap-5 shadow-[inset_0_-1px_0_var(--bl-sep)]',
    },
  },
  defaultVariants: { variant: 'segmented' },
});

export const tabVariants = cva(
  'bl-btn box-border flex cursor-pointer items-center justify-center gap-1.5 font-semibold whitespace-nowrap outline-none transition-[background-color,box-shadow,color] duration-200 ease-ios data-disabled:cursor-default data-disabled:opacity-40',
  {
    variants: {
      variant: {
        segmented:
          'flex-1 rounded-[7px] px-3 py-[5px] text-[13px] text-foreground data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 data-selected:bg-card data-selected:shadow-[0_1px_4px_rgba(0,0,0,.14)]',
        underline:
          'relative -mb-px h-10 px-0.5 text-[15px] text-muted-foreground data-hovered:text-foreground data-selected:text-primary data-selected:shadow-[inset_0_-2px_0_var(--bl-tint)] data-focus-visible:rounded-md data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45',
      },
    },
    defaultVariants: { variant: 'segmented' },
  },
);

type TabsVariant = VariantProps<typeof tabsListVariants>['variant'];
const TabsCtx = createContext<TabsVariant>('segmented');

export interface TabsProps extends AriaTabsProps {
  variant?: TabsVariant;
}

export function Tabs({ className, variant = 'segmented', onSelectionChange, ...props }: TabsProps) {
  // react-aria reports its automatic first selection too; only user changes tick.
  const last = useRef<Key | null>(props.selectedKey ?? props.defaultSelectedKey ?? null);
  return (
    <TabsCtx.Provider value={variant}>
      <AriaTabs
        data-slot="tabs"
        onSelectionChange={(key) => {
          if (last.current != null && key !== last.current) Haptics.selection();
          last.current = key;
          onSelectionChange?.(key);
        }}
        className={composeRenderProps(className, (cls) => cn('flex flex-col gap-4 data-[orientation=vertical]:flex-row', cls))}
        {...props}
      />
    </TabsCtx.Provider>
  );
}

export function TabList<T extends object>({ className, ...props }: AriaTabListProps<T>) {
  const variant = useContext(TabsCtx);
  return (
    <AriaTabList
      data-slot="tab-list"
      className={composeRenderProps(className, (cls) => cn(tabsListVariants({ variant }), cls))}
      {...props}
    />
  );
}

export function Tab({ className, ...props }: AriaTabProps) {
  const variant = useContext(TabsCtx);
  return (
    <AriaTab
      data-slot="tab"
      className={composeRenderProps(className, (cls) => cn(tabVariants({ variant }), cls))}
      {...props}
    />
  );
}

export function TabPanel({ className, ...props }: AriaTabPanelProps) {
  return (
    <AriaTabPanel
      data-slot="tab-panel"
      className={composeRenderProps(className, (cls) =>
        cn('rounded-[14px] outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 data-entering:animate-bl-fade-in', cls))}
      {...props}
    />
  );
}

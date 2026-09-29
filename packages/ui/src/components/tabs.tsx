import { createContext, useContext, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Key } from 'react-aria-components';
import {
  Tab as AriaTab, type TabProps as AriaTabProps,
  TabList as AriaTabList, type TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel, type TabPanelProps as AriaTabPanelProps,
  SelectionIndicator, TabListStateContext,
  Tabs as AriaTabs, type TabsProps as AriaTabsProps,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { useDirection } from '../lib/motion';
import { cn } from '../lib/utils';
import { segmentIndicator } from './segmented';

/* ══ Tabs — react-aria's Tabs (arrow keys move, automatic activation). `segmented` is the iOS segmented look,
   `underline` a tinted underline bar. One selection tick per change. ══ */
export const tabsListVariants = cva('isolate flex', {
  variants: {
    variant: {
      segmented: 'gap-0.5 rounded-[9px] bg-secondary p-0.5',
      underline: 'gap-5 shadow-[inset_0_-1px_0_var(--border)]',
    },
  },
  defaultVariants: { variant: 'segmented' },
});

export const tabVariants = cva(
  'bl-btn relative box-border flex cursor-pointer items-center justify-center gap-1.5 font-semibold whitespace-nowrap outline-none transition-[color] duration-spring-snappy ease-spring-snappy data-disabled:cursor-default data-disabled:opacity-40',
  {
    variants: {
      variant: {
        segmented:
          'flex-1 rounded-[7px] px-3 py-[5px] text-[13px] text-foreground data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45',
        underline:
          '-mb-px h-10 px-0.5 text-[15px] text-muted-foreground data-hovered:text-foreground data-selected:text-primary data-focus-visible:rounded-md data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45',
      },
    },
    defaultVariants: { variant: 'segmented' },
  },
);

/* ── Direction of the latest tab change, for panels that move with it ── */
const TabDirCtx = createContext<-1 | 0 | 1>(0);

/** Inside a react-aria Tabs: provides the direction of the latest selection change (by collection order). */
export function TabDirection({ children }: { children?: ReactNode }) {
  const state = useContext(TabListStateContext);
  const keys = state ? [...state.collection.getKeys()] : [];
  const dir = useDirection(state?.selectedKey != null ? keys.indexOf(state.selectedKey) : -1);
  return <TabDirCtx.Provider value={dir}>{children}</TabDirCtx.Provider>;
}

/** Style vars for a directional panel (`animate-bl-panel-in` / `-out` read them). */
export function useTabPanelDirection(orientation: 'horizontal' | 'vertical' = 'horizontal'): CSSProperties {
  const dir = useContext(TabDirCtx);
  return (orientation === 'vertical' ? { '--bl-dx': 0, '--bl-dy': dir } : { '--bl-dx': dir, '--bl-dy': 0 }) as unknown as CSSProperties;
}

type TabsVariant = VariantProps<typeof tabsListVariants>['variant'];
const TabsCtx = createContext<TabsVariant>('segmented');

export interface TabsProps extends AriaTabsProps {
  variant?: TabsVariant;
}

export function Tabs({ className, variant = 'segmented', onSelectionChange, children, ...props }: TabsProps) {
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
      >
        {composeRenderProps(children, (kids) => <TabDirection>{kids}</TabDirection>)}
      </AriaTabs>
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

/** Underline tabs: a 2px tint bar that slides and resizes to the selected tab. */
const underlineIndicator =
  'absolute bottom-0 left-0 -z-1 h-[2px] w-full bg-primary transition-[translate,width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none';

export function Tab({ className, children, ...props }: AriaTabProps) {
  const variant = useContext(TabsCtx);
  return (
    <AriaTab
      data-slot="tab"
      className={composeRenderProps(className, (cls) => cn(tabVariants({ variant }), cls))}
      {...props}
    >
      {composeRenderProps(children, (kids) => (
        <>
          <SelectionIndicator data-slot="tab-indicator" className={variant === 'underline' ? underlineIndicator : cn(segmentIndicator, 'bg-card')} />
          {kids}
        </>
      ))}
    </AriaTab>
  );
}

/** Panels arrive from the side of the newly selected tab (a tab to the left → content comes in from the left). */
export function TabPanel({ className, style, ...props }: AriaTabPanelProps) {
  const dir = useTabPanelDirection();
  return (
    <AriaTabPanel
      data-slot="tab-panel"
      className={composeRenderProps(className, (cls) =>
        cn('rounded-[14px] outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 data-entering:animate-bl-panel-in motion-reduce:data-entering:animate-bl-fade-in', cls))}
      style={composeRenderProps(style, (st) => ({ ...dir, ...st }))}
      {...props}
    />
  );
}

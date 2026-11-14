'use client';
import type { CSSProperties, ReactNode } from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import type { TabsValueChangeReason } from '@ui-sdk/core/tabs';
import { TabView, TabViewBar, TabViewList, TabViewTab } from '@/components/ui/tab-view';

export interface TabBarItem<T extends string = string> {
  value: T;
  title: ReactNode;
  icon: string;
  /** The tab's name, when `title` isn't plain text. Without it such a tab is named by its `value`. */
  'aria-label'?: string;
}

export interface TabBarProps<T extends string = string> {
  items: readonly TabBarItem<T>[];
  /** The selected tab. Pass it with `onValueChange` to control the bar. */
  value?: T;
  /** The tab selected at first, when uncontrolled (the first one otherwise). */
  defaultValue?: T;
  /** Runs when a tab is picked. `details.reason` says how (`item-press`, `list-navigation`), `details.cancel()` refuses it. */
  onValueChange?: (value: T, details: ChangeDetails<TabsValueChangeReason>) => void;
  hideOnScroll?: boolean;
  /** Names the tablist (default "Tabs"). */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/** The iOS bottom tab bar as a one-liner: a TabView (no panels) whose `bar` sits over the host's content.
    Compose `TabView` directly for panels, a vertical rail, or custom tabs. */
export function TabBar<T extends string = string>({
  items, value, defaultValue, onValueChange, hideOnScroll = true, 'aria-label': label = 'Tabs', className, style,
}: TabBarProps<T>) {
  return (
    <TabView<T>
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next, details) => { if (next !== null) onValueChange?.(next, details); }}
      className="contents"
    >
      <TabViewBar variant="bar" hideOnScroll={hideOnScroll} className={className} style={style}>
        <TabViewList aria-label={label}>
          {items.map((it) => (
            <TabViewTab key={it.value} value={it.value} icon={it.icon} title={it.title}
              aria-label={it['aria-label'] ?? (typeof it.title === 'string' ? undefined : it.value)} />
          ))}
        </TabViewList>
      </TabViewBar>
    </TabView>
  );
}

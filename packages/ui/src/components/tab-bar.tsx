import type { CSSProperties, ReactNode } from 'react';
import { TabView, TabViewBar, TabViewList, TabViewTab } from '@/components/ui/tab-view';

export interface TabBarItem {
  id: string;
  title: ReactNode;
  icon: string;
}

export interface TabBarProps {
  items: TabBarItem[];
  selected: string;
  onSelect: (id: string) => void;
  hideOnScroll?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** The iOS bottom tab bar as a one-liner: a TabView (no panels) whose `bar` sits over the host's content.
    Compose `TabView` directly for panels, a vertical rail, or custom tabs. */
export function TabBar({ items, selected, onSelect, hideOnScroll = true, className, style }: TabBarProps) {
  return (
    <TabView selectedKey={selected} onSelectionChange={(k) => onSelect(String(k))} className="contents">
      <TabViewBar variant="bar" hideOnScroll={hideOnScroll} className={className} style={style}>
        <TabViewList aria-label="Tabs" items={items}>
          {(it) => <TabViewTab id={it.id} icon={it.icon} title={it.title} textValue={typeof it.title === 'string' ? it.title : it.id} />}
        </TabViewList>
      </TabViewBar>
    </TabView>
  );
}

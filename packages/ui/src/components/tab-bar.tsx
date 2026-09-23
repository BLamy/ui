import type { CSSProperties, ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { useChromeHidden } from '../lib/theme';
import { cn } from '../lib/utils';

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

export function TabBar({ items, selected, onSelect, hideOnScroll = true, className, style }: TabBarProps) {
  const hid = useChromeHidden() && hideOnScroll;
  return (
    <div data-slot="tab-bar"
      className={cn(
        'absolute inset-x-0 bottom-0 z-120 box-border flex h-[62px] [border-top:1px_solid_var(--bl-sep)] bg-bl-bar pb-1 backdrop-blur-[20px] backdrop-saturate-[1.7] transition-transform duration-300 ease-ios',
        hid && 'translate-y-full',
        className,
      )}
      style={style}>
      {items.map((it) => {
        const onT = it.id === selected;
        return (
          <AriaButton key={it.id} onPress={() => { if (!onT) Haptics.selection(); onSelect(it.id); }} aria-current={onT ? 'page' : undefined}
            className={cn(
              'bl-btn flex flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 [font-family:inherit] transition-[color] duration-150',
              onT ? 'text-primary' : 'text-bl-label3',
            )}>
            <Icon name={it.icon} size={25} sw={onT ? 2.1 : 1.8} />
            <span className="text-[10px] font-semibold tracking-[.1px]">{it.title}</span>
          </AriaButton>
        );
      })}
    </div>
  );
}

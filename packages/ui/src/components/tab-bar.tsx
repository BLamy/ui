import type { CSSProperties, ReactNode } from 'react';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { useChromeHidden } from '../lib/theme';
import { cn, EASE } from '../lib/utils';

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
    <div data-slot="tab-bar" className={cn(className)} style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 120, display: 'flex', height: 62,
      background: 'var(--tk-bar)', backdropFilter: 'blur(20px) saturate(1.7)', WebkitBackdropFilter: 'blur(20px) saturate(1.7)',
      borderTop: '1px solid var(--tk-sep)', paddingBottom: 4, boxSizing: 'border-box',
      transform: hid ? 'translateY(100%)' : 'none', transition: 'transform .3s ' + EASE, ...style,
    }}>
      {items.map((it) => {
        const onT = it.id === selected;
        return (
          <button key={it.id} className="tk-btn" onClick={() => { if (!onT) Haptics.selection(); onSelect(it.id); }} aria-current={onT ? 'page' : undefined}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 0,
              background: 'none', cursor: 'pointer', color: onT ? 'var(--tk-tint)' : 'var(--tk-label3)', fontFamily: 'inherit', padding: 0, transition: 'color .15s',
            }}>
            <Icon name={it.icon} size={25} sw={onT ? 2.1 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1px' }}>{it.title}</span>
          </button>
        );
      })}
    </div>
  );
}

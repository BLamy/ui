import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { ToggleGroup } from '@ui-sdk/react/toggle';
import { buttonVariants } from '@/components/ui/button';
import { PlainToggleButton } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

const ITEMS = [
  { id: 'home', icon: 'house', label: 'Home' },
  { id: 'docs', icon: 'doc', label: 'Documents' },
  { id: 'history', icon: 'clock', label: 'Recent' },
  { id: 'mentions', icon: 'at', label: 'Mentions' },
  { id: 'more', icon: 'ellipsis', label: 'More' },
  { id: 'git', icon: 'branch', label: 'Changes' },
];

/** The narrow icon rail at the sidebar's left edge: one section at a time (a vertical UI SDK ToggleGroup, one tab
    stop, arrow keys between them), with the signed-in user at the bottom. */
export function Rail() {
  const [active, setActive] = useState('home');
  return (
    <div data-slot="codex-rail" className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 py-3 shadow-[inset_-1px_0_0_var(--border)]">
      <ToggleGroup
        aria-label="Sections"
        orientation="vertical"
        deselectable={false}
        value={[active]}
        onValueChange={([id]) => id && setActive(id)}
        className="flex flex-col items-center gap-1.5"
      >
        {ITEMS.map((i) => (
          <PlainToggleButton key={i.id} value={i.id} aria-label={i.label} title={i.label} className={cn(buttonVariants({ variant: 'quiet', size: 'icon-sm' }), 'size-9')}>
            <Icon name={i.icon} size={19} sw={1.7} />
          </PlainToggleButton>
        ))}
      </ToggleGroup>
      <span className="flex-1" />
      <Avatar c={{ f: 'B', l: 'L' }} size={26} />
    </div>
  );
}

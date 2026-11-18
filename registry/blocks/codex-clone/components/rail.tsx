import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { ToggleGroup } from '@brett_lamy/ui/sdk/react/toggle';
import { Toggle } from '@/components/ui/toggle';
import { Icon } from '@/lib/icon';

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
          <Toggle key={i.id} value={i.id} aria-label={i.label} title={i.label} variant="quiet" size="icon" className="rounded-lg">
            <Icon name={i.icon} size={19} sw={1.7} />
          </Toggle>
        ))}
      </ToggleGroup>
      <span className="flex-1" />
      <Avatar name="B L" size={26} />
    </div>
  );
}

import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';

const ITEMS = [
  { id: 'home', icon: 'house', label: 'Home' },
  { id: 'docs', icon: 'doc', label: 'Documents' },
  { id: 'history', icon: 'clock', label: 'Recent' },
  { id: 'mentions', icon: 'at', label: 'Mentions' },
  { id: 'more', icon: 'ellipsis', label: 'More' },
  { id: 'git', icon: 'branch', label: 'Changes' },
];

/** The narrow icon rail at the sidebar's left edge, with the signed-in user at the bottom. */
export function Rail() {
  const [active, setActive] = useState('home');
  return (
    <nav data-slot="codex-rail" aria-label="Sections" className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 py-3 shadow-[inset_-1px_0_0_var(--border)]">
      {ITEMS.map((i) => (
        <IconButton key={i.id} name={i.icon} label={i.label} size={19} active={active === i.id} onPress={() => setActive(i.id)} className="size-9" />
      ))}
      <span className="flex-1" />
      <Avatar c={{ f: 'B', l: 'L' }} size={26} />
    </nav>
  );
}

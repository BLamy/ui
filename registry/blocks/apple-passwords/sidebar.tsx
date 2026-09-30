/* The sidebar: Passwords' category tiles (icon, count, name) over the shared groups. Tiles and group rows
   select into the SplitView's sidebar column, so on a phone they push the list. */
import type { CSSProperties } from 'react';
import {
  Avatar, Icon, NumberMorph, SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, cn, useSplitView, type IconName,
} from '@brett_lamy/ui';
import { GROUPS, type CategoryId } from './data';
import { counts, type Vault } from './vault';

const TILES: { id: CategoryId; label: string; icon: IconName; color: string }[] = [
  { id: 'all', label: 'All', icon: 'key', color: '#0A84FF' },
  { id: 'passkeys', label: 'Passkeys', icon: 'passkey', color: '#30B94D' },
  { id: 'codes', label: 'Codes', icon: 'lock-rotation', color: '#F5B400' },
  { id: 'wifi', label: 'Wi-Fi', icon: 'wifi', color: '#32ADE6' },
  { id: 'security', label: 'Security', icon: 'shield-exclamation', color: '#FF3B30' },
  { id: 'deleted', label: 'Deleted', icon: 'trash', color: '#FF9500' },
];

export function Sidebar({ vault }: { vault: Vault }) {
  const n = counts(vault);
  return (
    <>
      <SplitViewHeader title="Passwords" className="shadow-none" />
      <SplitViewContent className="px-3 pt-1 pb-6">
        <div className="grid grid-cols-2 gap-2.5">
          {TILES.map((t) => <Tile key={t.id} {...t} count={n[t.id]} />)}
        </div>
        <SplitViewSection title="Shared Groups" className="mt-2">
          {GROUPS.map((g) => (
            <SplitViewItem key={g.id} id={'group:' + g.id}
              icon={<Icon name="people" size={20} />}
              title={g.name}
              subtitle={g.members.map((m) => m.f).join(', ')}
              badge={vault.accounts.filter((a) => a.group === g.id).length} />
          ))}
        </SplitViewSection>
        <div className="mt-5 flex items-center gap-2 px-2.5 text-[12.5px] text-muted-foreground">
          <span className="flex -space-x-1.5">
            {GROUPS[0].members.map((m) => <Avatar key={m.f} c={m} size={20} className="ring-2 ring-sidebar" />)}
          </span>
          Family members can see passwords in Family.
        </div>
      </SplitViewContent>
    </>
  );
}

function Tile({ id, label, icon, color, count }: { id: CategoryId; label: string; icon: IconName; color: string; count: number }) {
  const sv = useSplitView();
  const selected = sv.isSelected('sidebar', id);
  return (
    <button type="button" aria-current={selected || undefined}
      onClick={() => sv.select('sidebar', id)}
      className={cn(
        'bl-btn group flex cursor-pointer flex-col gap-2 rounded-[12px] border-0 p-2.5 text-left [font-family:inherit] outline-none',
        'transition-[background-color,scale,box-shadow] duration-spring-snappy ease-spring-snappy active:scale-[.97]',
        'focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground shadow-[0_.5px_1.5px_black] shadow-black/8 hover:bg-[color-mix(in_oklab,var(--card)_92%,var(--foreground))]',
      )}>
      <span className="flex w-full items-start justify-between">
        <span className={cn('grid size-[30px] place-items-center rounded-full transition-colors duration-200', selected ? 'bg-white text-(--tile)' : 'bg-(--tile) text-white')}
          style={{ '--tile': color } as CSSProperties}>
          <Icon name={icon} size={18} weight="semibold" />
        </span>
        <span className="pt-0.5 text-[20px] font-bold tabular-nums"><NumberMorph value={count} /></span>
      </span>
      <span className="text-[14px] font-semibold">{label}</span>
    </button>
  );
}

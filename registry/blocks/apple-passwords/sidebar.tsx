/* The sidebar: Passwords' category tiles (icon, count, name) over the shared groups and the developer sign-in
   buttons. Tiles and group rows select into the SplitView's sidebar column, so on a phone they push the list.
   A group row and the family avatars preview who's in the group. */
import type { CSSProperties } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { AvatarGroup } from '@/components/ui/avatar-group';
import { HoverCardHeader } from '@/components/ui/hover-card';
import { NumberMorph } from '@/components/ui/number-morph';
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection } from '@/components/ui/split-view';
import { Icon, type IconName } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { GROUPS, type CategoryId } from './data';
import type { ServiceId } from './device-auth';
import { GroupPreview } from './previews';
import { ServiceButtons } from './sign-in';
import { counts, type Vault } from './vault';

const TILES: { id: CategoryId; label: string; icon: IconName; color: string }[] = [
  { id: 'all', label: 'All', icon: 'key', color: '#0A84FF' },
  { id: 'passkeys', label: 'Passkeys', icon: 'passkey', color: '#30B94D' },
  { id: 'codes', label: 'Codes', icon: 'lock-rotation', color: '#F5B400' },
  { id: 'wifi', label: 'Wi-Fi', icon: 'wifi', color: '#32ADE6' },
  { id: 'security', label: 'Security', icon: 'shield-exclamation', color: '#FF3B30' },
  { id: 'deleted', label: 'Deleted', icon: 'trash', color: '#FF9500' },
];

export function Sidebar({ vault, onOpenService }: { vault: Vault; onOpenService: (id: ServiceId) => void }) {
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
            <SplitViewItem key={g.id} value={'group:' + g.id}
              icon={<Icon name="people" size={20} />}
              title={g.name}
              description={g.members.map((m) => m.f).join(', ')}
              trailing={vault.accounts.filter((a) => a.group === g.id).length}
              preview={<GroupPreview group={g} vault={vault} />} />
          ))}
        </SplitViewSection>
        <ServiceButtons onOpen={onOpenService} />
        <div className="mt-5 flex items-center gap-2 px-2.5 text-[12.5px] text-muted-foreground">
          <AvatarGroup size={20} aria-label={GROUPS[0].name} className="[--avatar-ring:var(--sidebar)]">
            {GROUPS[0].members.map((m) => (
              <Avatar key={m.f} name={`${m.f} ${m.l}`}
                card={<HoverCardHeader icon={<Avatar name={`${m.f} ${m.l}`} size={40} />} title={`${m.f} ${m.l}`} description={`${GROUPS[0].name} · Shared passwords`} />} />
            ))}
          </AvatarGroup>
          Family members can see passwords in Family.
        </div>
      </SplitViewContent>
    </>
  );
}

/** A category: a card that fills with the accent when selected. A SplitViewItem, so it selects (or pushes) like a row. */
function Tile({ id, label, icon, color, count }: { id: CategoryId; label: string; icon: IconName; color: string; count: number }) {
  return (
    <SplitViewItem value={id}
      className={cn(
        'min-h-0 flex-col items-stretch gap-2 rounded-panel p-2.5',
        'transition-[background-color,scale,box-shadow] duration-spring-snappy ease-spring-snappy active:scale-[.97]',
        'bg-card text-foreground shadow-[0_.5px_1.5px_black] shadow-black/8 hover:bg-[color-mix(in_oklab,var(--card)_92%,var(--foreground))] active:bg-[color-mix(in_oklab,var(--card)_92%,var(--foreground))]',
        'data-selected:bg-primary data-selected:text-primary-foreground data-selected:shadow-none data-selected:hover:bg-primary data-selected:active:bg-primary',
      )}>
      <span className="flex w-full items-start justify-between">
        <span className="grid size-[30px] place-items-center rounded-full bg-(--tile) text-white transition-colors duration-200 group-data-current/item:bg-white group-data-current/item:text-(--tile)"
          style={{ '--tile': color } as CSSProperties}>
          <Icon name={icon} size={18} weight="semibold" />
        </span>
        <span className="pt-0.5 text-title font-bold tabular-nums"><NumberMorph value={count} /></span>
      </span>
      <span className="text-detail font-semibold">{label}</span>
    </SplitViewItem>
  );
}

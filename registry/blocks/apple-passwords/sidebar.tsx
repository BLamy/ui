/* The sidebar: Passwords' category tiles (icon, count, name) over the shared groups. Tiles and group rows
   select into the SplitView's sidebar column, so on a phone they push the list. */
import { Avatar, Haptics, NumberMorph, SplitViewContent, SplitViewHeader, SplitViewItem, cn, useSplitView } from '@brett_lamy/ui';
import { GROUPS, type CategoryId } from './data';
import { Glyph, type GlyphName } from './glyphs';
import type { Vault } from './vault';
import { counts } from './vault';

const TILES: { id: CategoryId; label: string; glyph: GlyphName; color: string }[] = [
  { id: 'all', label: 'All', glyph: 'key', color: '#0A84FF' },
  { id: 'passkeys', label: 'Passkeys', glyph: 'passkey', color: '#30B94D' },
  { id: 'codes', label: 'Codes', glyph: 'codes', color: '#F5B400' },
  { id: 'wifi', label: 'Wi-Fi', glyph: 'wifi', color: '#32ADE6' },
  { id: 'security', label: 'Security', glyph: 'shield', color: '#FF3B30' },
  { id: 'deleted', label: 'Deleted', glyph: 'trash', color: '#FF9500' },
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
        <div className="mt-6 mb-1.5 px-2.5 text-[13px] font-semibold text-muted-foreground">Shared Groups</div>
        {GROUPS.map((g) => (
          <SplitViewItem key={g.id} id={'group:' + g.id}
            icon={<Glyph name="group" size={20} />}
            title={g.name}
            subtitle={g.members.map((m) => m.f).join(', ')}
            badge={vault.accounts.filter((a) => a.group === g.id).length} />
        ))}
        <div className="mt-5 flex items-center gap-2 px-2.5 text-[12.5px] text-muted-foreground">
          <span className="flex -space-x-1.5">
            {GROUPS[0].members.map((m) => <Avatar key={m.f} c={m} size={20} className="ring-2 ring-bl-side" />)}
          </span>
          Family members can see passwords in Family.
        </div>
      </SplitViewContent>
    </>
  );
}

function Tile({ id, label, glyph, color, count }: { id: CategoryId; label: string; glyph: GlyphName; color: string; count: number }) {
  const sv = useSplitView();
  const selected = sv.isSelected('sidebar', id);
  return (
    <button type="button" aria-current={selected || undefined}
      onClick={() => { Haptics.selection(); sv.select('sidebar', id); }}
      className={cn(
        'bl-btn group flex cursor-pointer flex-col gap-2 rounded-[12px] border-0 p-2.5 text-left [font-family:inherit] outline-none',
        'transition-[background-color,scale,box-shadow] duration-spring-snappy ease-spring-snappy active:scale-[.97]',
        'focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'bg-primary text-primary-foreground' : 'bg-bl-card text-foreground shadow-[0_.5px_1.5px_rgba(0,0,0,.08)] hover:bg-[color-mix(in_oklab,var(--bl-card)_92%,var(--bl-label))]',
      )}>
      <span className="flex w-full items-start justify-between">
        <span className="grid size-[30px] place-items-center rounded-full transition-colors duration-200"
          style={{ background: selected ? '#fff' : color, color: selected ? color : '#fff' }}>
          <Glyph name={glyph} size={18} sw={2.1} />
        </span>
        <span className="pt-0.5 text-[20px] font-bold tabular-nums"><NumberMorph value={count} /></span>
      </span>
      <span className="text-[14px] font-semibold">{label}</span>
    </button>
  );
}

/* The lists column: search, the smart-list tiles (Today, Scheduled, All, Flagged, Completed) with live counts,
   and My Lists. On a phone it's the root screen and search results show right here. */
import { NumberMorph } from '@/components/ui/number-morph';
import { SearchField } from '@/components/ui/search-field';
import { SplitViewContent, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { SMART, SYSTEM, TODAY_NUMBER, type RList, type Smart } from './data';
import { ListIcon, ReminderRow } from './reminder-row';
import { useReminders } from './store';
import { buildView, countFor } from './views';

/** A calendar page with nothing printed on it: Today's tile writes the date on it. */
const PAGE = [{ d: 'M4.2 6.6c0-.9.7-1.6 1.6-1.6h12.4c.9 0 1.6.7 1.6 1.6v11.8c0 .9-.7 1.6-1.6 1.6H5.8c-.9 0-1.6-.7-1.6-1.6z' }];

function SmartIcon({ glyph }: { glyph: Smart['glyph'] }) {
  if (glyph !== 'today') return <Icon name={glyph} size={17} weight="semibold" />;
  return (
    <span className="relative">
      <Icon shapes={PAGE} size={20} weight="semibold" />
      <span className="absolute inset-x-0 top-[9px] text-center text-[7px] leading-none font-bold">{TODAY_NUMBER}</span>
    </span>
  );
}

/** A smart list: a card that fills with its own color (`tint`) when selected. */
function SmartTile({ t }: { t: Smart }) {
  const { items } = useReminders();
  return (
    <SplitViewItem id={t.id} tint={t.color}
      className="min-h-0 flex-col items-stretch gap-1.5 rounded-[12px] bg-card px-2.5 pt-2.5 pb-2 data-hovered:bg-card data-pressed:scale-[.97] data-selected:bg-(--split-item-tint) transition-[background-color,scale] duration-spring-snappy ease-spring-snappy">
      <span className="flex items-start justify-between">
        <span className="grid size-[31px] place-items-center rounded-full bg-(--split-item-tint) text-white group-data-selected/item:bg-white group-data-selected/item:text-(--split-item-tint)">
          <SmartIcon glyph={t.glyph} />
        </span>
        <NumberMorph value={countFor(t.id, items)} className="text-[26px] leading-[30px] font-bold tabular-nums" />
      </span>
      <span className="text-[15px] font-semibold text-muted-foreground group-data-selected/item:text-white">{t.name}</span>
    </SplitViewItem>
  );
}

function ListItem({ l, collapsed }: { l: RList; collapsed: boolean }) {
  const { items } = useReminders();
  return (
    <SplitViewItem id={l.id} tint={l.color}
      className="min-h-[50px] gap-3 rounded-[10px] px-3 text-[17px] after:absolute after:right-0 after:bottom-0 after:left-[55px] after:h-px after:bg-border last:after:hidden data-selected:after:hidden">
      <ListIcon glyph={l.glyph} color={l.color} size={30} className="transition-colors duration-150 group-data-selected/item:bg-white group-data-selected/item:text-(--list-color)" />
      <span className="min-w-0 flex-1 truncate">{l.name}</span>
      <span className="text-muted-foreground tabular-nums group-data-selected/item:text-white/85">{countFor(l.id, items)}</span>
      {collapsed ? <Icon name="chevron-right" size={14} weight="bold" className="text-tertiary-foreground" /> : null}
    </SplitViewItem>
  );
}

/** Phone search: every matching reminder, grouped by list, right under the field. */
function InlineResults() {
  const api = useReminders();
  const v = buildView('search', api.items, api.lists, api.recent, api.showCompleted, api.query);
  if (!v.groups.length) return <div className="py-16 text-center text-[17px] text-muted-foreground">No Results</div>;
  return (
    <div className="-mx-4">
      {v.groups.map((g) => (
        <section key={g.key} className="pb-3">
          <h3 className="m-0 px-4 pt-3 pb-1 text-[20px] font-bold" style={{ color: g.color }}>{g.title}</h3>
          {g.items.map((r) => <ReminderRow key={r.id} r={r} color={g.color ?? SYSTEM.gray} phone />)}
        </section>
      ))}
    </div>
  );
}

export function ListsSidebar() {
  const api = useReminders();
  const s = useSplitView();
  const addList = () => s.select('sidebar', api.addList());
  return (
    <SplitViewSidebar aria-label="Lists" width={330} minWidth={280} maxWidth={400} className="bg-muted">
      <SplitViewContent className="px-4 pb-4">
        <SearchField value={api.query} onChange={api.setQuery} aria-label="Search reminders" className="mt-3 mb-4" />
        {api.query && s.collapsed ? <InlineResults /> : (
          <>
            <div className="grid grid-cols-2 gap-3">{SMART.map((t) => <SmartTile key={t.id} t={t} />)}</div>
            <SplitViewSection title={<span className="-mx-1.5 mt-2 mb-0.5 block text-[20px] font-bold tracking-[-.2px] text-foreground">My Lists</span>}>
              <div className="overflow-hidden rounded-[12px] bg-card">
                {api.lists.map((l) => <ListItem key={l.id} l={l} collapsed={s.collapsed} />)}
              </div>
            </SplitViewSection>
          </>
        )}
      </SplitViewContent>
      <div className="flex h-[50px] shrink-0 items-center justify-end px-4">
        <button type="button" onClick={addList} className="bl-btn cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] text-[17px]" style={{ color: SYSTEM.blue }}>Add List</button>
      </div>
    </SplitViewSidebar>
  );
}

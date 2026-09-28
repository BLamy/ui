/* The lists column: search, the smart-list tiles (Today, Scheduled, All, Flagged, Completed) with live counts,
   and My Lists. On a phone it's the root screen and search results show right here. */
import type { CSSProperties } from 'react';
import { Haptics, NumberMorph, SearchField, SplitViewContent, SplitViewItem, SplitViewSidebar, useSplitView } from '@brett_lamy/ui';
import { SMART, type RList, type Smart } from './data';
import { Glyph, ListIcon } from './glyphs';
import { ReminderRow } from './reminder-row';
import { useReminders } from './store';
import { buildView, countFor } from './views';

function SmartTile({ t }: { t: Smart }) {
  const { items } = useReminders();
  return (
    <div style={{ '--c': t.color } as CSSProperties}>
      <SplitViewItem id={t.id}
        className="min-h-0 flex-col items-stretch gap-1.5 rounded-[12px] bg-card px-2.5 pt-2.5 pb-2 data-hovered:bg-card data-pressed:scale-[.97] data-selected:bg-(--c) data-selected:text-white transition-[background-color,scale] duration-spring-snappy ease-spring-snappy">
        <span className="flex items-start justify-between">
          <span className="grid size-[31px] place-items-center rounded-full bg-(--c) text-white group-data-selected/item:bg-white group-data-selected/item:text-(--c)">
            <Glyph name={t.glyph} size={t.glyph === 'calendarDay' ? 20 : 17} sw={2.2} />
          </span>
          <NumberMorph value={countFor(t.id, items)} className="text-[26px] leading-[30px] font-bold tabular-nums" />
        </span>
        <span className="text-[15px] font-semibold text-muted-foreground group-data-selected/item:text-white">{t.name}</span>
      </SplitViewItem>
    </div>
  );
}

function ListItem({ l, collapsed }: { l: RList; collapsed: boolean }) {
  const { items } = useReminders();
  return (
    <SplitViewItem id={l.id}
      className="min-h-[50px] gap-3 rounded-[10px] px-3 text-[17px] after:absolute after:right-0 after:bottom-0 after:left-[55px] after:h-px after:bg-bl-sep last:after:hidden data-selected:after:hidden">
      <ListIcon glyph={l.glyph} color={l.color} size={30} />
      <span className="min-w-0 flex-1 truncate">{l.name}</span>
      <span className="text-muted-foreground tabular-nums group-data-selected/item:text-white/85">{countFor(l.id, items)}</span>
      {collapsed ? <Glyph name="chevron" size={14} sw={2.6} className="text-bl-label3" /> : null}
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
          {g.items.map((r) => <ReminderRow key={r.id} r={r} color={g.color ?? '#8E8E93'} phone />)}
        </section>
      ))}
    </div>
  );
}

export function ListsSidebar() {
  const api = useReminders();
  const s = useSplitView();
  const addList = () => { Haptics.impact('light'); s.select('sidebar', api.addList()); };
  return (
    <SplitViewSidebar aria-label="Lists" width={330} minWidth={280} maxWidth={400} className="bg-muted">
      <SplitViewContent className="px-4 pb-4">
        <SearchField value={api.query} onChange={api.setQuery} aria-label="Search reminders" className="mt-3 mb-4" />
        {api.query && s.collapsed ? <InlineResults /> : (
          <>
            <div className="grid grid-cols-2 gap-3">{SMART.map((t) => <SmartTile key={t.id} t={t} />)}</div>
            <h2 className="m-0 px-1 pt-6 pb-2 text-[20px] font-bold tracking-[-.2px]">My Lists</h2>
            <div className="overflow-hidden rounded-[12px] bg-card">
              {api.lists.map((l) => <ListItem key={l.id} l={l} collapsed={s.collapsed} />)}
            </div>
          </>
        )}
      </SplitViewContent>
      <div className="flex h-[50px] shrink-0 items-center justify-end px-4">
        <button type="button" onClick={addList} className="bl-btn cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] text-[17px] text-[#007AFF]">Add List</button>
      </div>
    </SplitViewSidebar>
  );
}

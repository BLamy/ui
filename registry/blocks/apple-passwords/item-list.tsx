/* The middle column: the selected category's items with search. Rows are SplitViewItems, so they select the
   detail beside them — or push it on a phone. */
import { Haptics, Icon, SearchField, SplitViewContent, SplitViewEmpty, SplitViewHeader, SplitViewItem, SplitViewToggle, cn } from '@brett_lamy/ui';
import { SEVERITY } from './data';
import { CodeValue, SiteTile, WifiTile } from './parts';
import { categoryTitle, type Entry, type EntrySection, type Selection } from './vault';

export function ItemList({ category, sections, query, onQuery, now, onAdd }: {
  category: Selection; sections: EntrySection[]; query: string; onQuery: (q: string) => void; now: number; onAdd: () => void;
}) {
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const canAdd = category !== 'wifi' && category !== 'deleted' && category !== 'security';
  return (
    <>
      <SplitViewHeader title={categoryTitle(category)} leading={<SplitViewToggle />}
        trailing={canAdd ? (
          <button type="button" aria-label="New password" onClick={() => { Haptics.impact('light'); onAdd(); }}
            className="bl-btn grid size-9 cursor-pointer place-items-center rounded-[10px] border-0 bg-transparent text-primary transition-[background-color,scale] duration-spring-snappy ease-spring-snappy hover:bg-bl-fill active:scale-90">
            <Icon name="plus" size={21} weight="semibold" />
          </button>
        ) : null} />
      <div className="px-3 pt-2.5 pb-2">
        <SearchField value={query} onChange={onQuery} placeholder={`Search ${categoryTitle(category)}`} className="py-[6px] [&_input]:text-[15px]" />
      </div>
      <SplitViewContent>
        {total === 0 ? (
          <SplitViewEmpty icon={<Icon name={query ? 'magnifyingglass' : 'key'} size={34} />}
            title={query ? 'No Results' : category === 'security' ? 'No Security Recommendations' : 'Nothing Here'}
            description={query ? `Nothing matches “${query}”.` : category === 'deleted' ? 'Deleted passwords stay here for 30 days.' : undefined} />
        ) : sections.map((s) => (
          <section key={s.title ?? 'items'} aria-label={s.title}>
            {s.title ? <div className="px-4 pt-3 pb-1 text-[13px] font-semibold text-muted-foreground">{s.title}</div> : null}
            {s.items.map((e) => <Row key={e.id} entry={e} category={category} now={now} />)}
          </section>
        ))}
        {total > 0 ? (
          <div className="py-4 text-center text-[12.5px] text-muted-foreground">
            {total} {category === 'wifi' ? (total === 1 ? 'network' : 'networks') : total === 1 ? 'item' : 'items'}
          </div>
        ) : null}
      </SplitViewContent>
    </>
  );
}

function Row({ entry: e, category, now }: { entry: Entry; category: Selection; now: number }) {
  const a = e.account;
  return (
    <SplitViewItem id={e.id} variant="row" className="min-h-[58px] py-2">
      {e.kind === 'wifi' ? (
        <WifiTile />
      ) : <SiteTile title={e.title} color={a!.color} size={32} className={cn(e.kind === 'deleted' && 'opacity-60 grayscale')} />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15.5px] font-medium leading-[1.3]">{e.title}</span>
          {a?.group && category === 'all' ? <Icon name="people" size={14} className="text-muted-foreground" /> : null}
        </span>
        <span className={cn('mt-px block truncate text-[13px]', e.severity && e.kind === 'account' && category === 'security' ? '' : 'text-muted-foreground')}
          style={e.severity && category === 'security' ? { color: SEVERITY[e.severity].color === '#FFCC00' ? '#C79A00' : SEVERITY[e.severity].color } : undefined}>
          {e.kind === 'deleted' ? a!.deleted : e.subtitle}
        </span>
      </span>
      {category === 'codes' && a?.otp ? <CodeValue seed={a.otp} now={now} /> : null}
      {e.severity && category === 'security' ? (
        <Icon name="warning-fill" size={18} style={{ color: SEVERITY[e.severity].color }} />
      ) : null}
    </SplitViewItem>
  );
}

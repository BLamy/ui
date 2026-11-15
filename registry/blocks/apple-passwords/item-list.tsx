/* The middle column: the selected category's items with search. Rows are SplitViewItems, so they select the
   detail beside them — or push it on a phone. Resting on a sign-in previews it (AccountPreview). */
import { Button as SdkButton } from '@ui-sdk/react/button';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSidebarTrigger } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { SEVERITY } from './data';
import { CodeValue, SiteTile, WifiTile, type CodeClock } from './parts';
import { AccountPreview } from './previews';
import { categoryTitle, type Entry, type EntrySection, type Selection } from './vault';

export function ItemList({ category, sections, query, onQuery, now, onAdd }: {
  category: Selection; sections: EntrySection[]; query: string; onQuery: (q: string) => void; now: CodeClock; onAdd: () => void;
}) {
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const canAdd = category !== 'wifi' && category !== 'deleted' && category !== 'security';
  return (
    <>
      <SplitViewHeader title={categoryTitle(category)} leading={<SplitViewSidebarTrigger />}
        trailing={canAdd ? (
          <SdkButton aria-label="New password" onClick={() => onAdd()}
            className="bl-btn grid size-9 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-primary transition-[background-color,scale] duration-spring-snappy ease-spring-snappy hover:bg-secondary active:scale-90">
            <Icon name="plus" size={21} weight="semibold" />
          </SdkButton>
        ) : null} />
      <div className="px-3 pt-2.5 pb-2">
        <SearchInput value={query} onValueChange={onQuery} placeholder={`Search ${categoryTitle(category)}`} className="h-[34px] [&_input]:text-subhead" />
      </div>
      <SplitViewContent>
        {total === 0 ? (
          <EmptyState icon={<Icon name={query ? 'magnifyingglass' : 'key'} size={34} />}
            title={query ? 'No Results' : category === 'security' ? 'No Security Recommendations' : 'Nothing Here'}
            description={query ? `Nothing matches “${query}”.` : category === 'deleted' ? 'Deleted passwords stay here for 30 days.' : undefined} />
        ) : sections.map((s) => (
          <section key={s.title ?? 'items'} aria-label={s.title}>
            {s.title ? <div className="px-4 pt-3 pb-1 text-footnote font-semibold text-muted-foreground">{s.title}</div> : null}
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

function Row({ entry: e, category, now }: { entry: Entry; category: Selection; now: CodeClock }) {
  const a = e.account;
  // Wi-Fi rows already show all a network has but its password.
  return (
    <SplitViewItem value={e.id} variant="row" className="min-h-[58px] py-2" preview={a ? <AccountPreview account={a} /> : undefined}>
      {e.kind === 'wifi' ? (
        <WifiTile />
      ) : <SiteTile title={e.title} color={a!.color} size={32} className={cn(e.kind === 'deleted' && 'opacity-60 grayscale')} />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15.5px] font-medium leading-[1.3]">{e.title}</span>
          {a?.group && category === 'all' ? <Icon name="people" size={14} className="text-muted-foreground" /> : null}
        </span>
        <span className={cn('mt-px block truncate text-footnote', e.severity && e.kind === 'account' && category === 'security' ? '' : 'text-muted-foreground')}
          style={e.severity && category === 'security' ? { color: SEVERITY[e.severity].ink } : undefined}>
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

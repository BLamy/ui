/* The sidebar: iOS / iPadOS Settings (large title, search, account card, inset groups) on phones and tablets —
   on a phone it is the root list and every row pushes — and macOS System Settings (window controls, compact
   search, dense rows with small icons) on desktop. Rows select panes in the SplitView. */
import {
  Avatar, Icon, SearchField, SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView,
} from '@brett_lamy/ui';
import { ACCOUNT, GROUPS, getPane, type Row, type Values } from './data';
import { RowView, SearchResults, Tile } from './rows';
import { useSettings } from './state';

const valueOf = (r: Extract<Row, { t: 'link' }>, v: Values) => (typeof r.value === 'function' ? r.value(v) : r.value);

/** On a phone the sidebar rows push, so they end in a chevron. */
function Disclosure() {
  return useSplitView().collapsed ? <Icon name="chevron-right" size={15} weight="bold" className="text-tertiary-foreground" /> : null;
}

/** One pane in the iOS sidebar: tile, title, value; blue fill when selected. */
function IosItem({ row }: { row: Extract<Row, { t: 'link' }> }) {
  const s = useSettings();
  const p = getPane(row.to);
  if (!p?.glyph || !p.color) return null;
  return (
    <SplitViewItem id={row.to}
      className="min-h-[46px] gap-3 rounded-[10px] px-4 text-[17px] after:absolute after:right-0 after:bottom-0 after:left-[57px] after:h-px after:bg-border last:after:hidden data-selected:after:hidden">
      <Tile glyph={p.glyph} color={p.color} />
      <span className="min-w-0 flex-1 truncate">{p.title}</span>
      <span className="max-w-[45%] truncate text-[16px] text-muted-foreground group-data-selected/item:text-white/80">{valueOf(row, s.values)}</span>
      <Disclosure />
    </SplitViewItem>
  );
}

function MacItem({ row }: { row: Extract<Row, { t: 'link' }> }) {
  const p = getPane(row.to);
  if (!p?.glyph || !p.color) return null;
  return (
    <SplitViewItem id={row.to} className="min-h-[30px] gap-2 rounded-[7px] px-2 py-[3px] text-[13px]">
      <Tile glyph={p.glyph} color={p.color} size={20} />
      <span className="min-w-0 flex-1 truncate">{p.title}</span>
    </SplitViewItem>
  );
}

export function SettingsSidebar() {
  const s = useSettings();
  const split = useSplitView();
  // Search hits open a pane; on a phone that also pushes the detail over the list.
  const results = <SearchResults onOpen={() => split.show('detail')} />;
  if (s.layout === 'desktop') {
    return (
      <SplitViewSidebar aria-label="Settings" width={260} minWidth={220} maxWidth={320} className={s.dark ? 'bg-[#232326]' : undefined}>
        <div aria-hidden="true" className="flex h-[52px] shrink-0 items-center gap-2 px-5">
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} className="size-3 rounded-full shadow-[inset_0_0_0_.5px_rgba(0,0,0,.18)]" style={{ background: c }} />)}
        </div>
        <div className="px-3 pb-2">
          <SearchField value={s.query} onChange={s.setQuery} aria-label="Search settings" className="gap-1.5 rounded-[7px] bg-secondary px-2 py-[5px] [&_input]:text-[13px] [&_svg]:size-[14px]" />
        </div>
        <SplitViewContent className="px-2.5 pb-4">
          {s.query ? <div className="pt-1">{results}</div> : (
            <>
              <SplitViewItem id="account" className="min-h-[46px] gap-2.5 rounded-[7px] px-2 py-1.5">
                <Avatar c={{ f: ACCOUNT.first, l: ACCOUNT.last }} size={32} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13px] font-semibold">{ACCOUNT.first} {ACCOUNT.last}</span>
                  <span className="block truncate text-[11px] text-muted-foreground group-data-selected/item:text-white/80">Apple Account</span>
                </span>
              </SplitViewItem>
              {GROUPS.map((g, i) => (
                <SplitViewSection key={i} className="mt-3">{g.map((r) => (r.t === 'link' ? <MacItem key={r.to} row={r} /> : null))}</SplitViewSection>
              ))}
            </>
          )}
        </SplitViewContent>
      </SplitViewSidebar>
    );
  }
  return (
    <SplitViewSidebar aria-label="Settings" width={350} minWidth={300} maxWidth={420} className="bg-muted">
      <SplitViewHeader title="Settings" largeTitle />
      <SplitViewContent>
        <div className="px-4 pb-6">
          <SearchField value={s.query} onChange={s.setQuery} aria-label="Search settings" className="mb-5" />
          {s.query ? results : (
            <>
              <div className="mb-5 overflow-hidden rounded-[12px] bg-card">
                <SplitViewItem id="account" className="min-h-[76px] gap-3.5 rounded-[12px] px-3 py-2.5">
                  <Avatar c={{ f: ACCOUNT.first, l: ACCOUNT.last }} size={56} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[20px] leading-tight font-semibold">{ACCOUNT.first} {ACCOUNT.last}</span>
                    <span className="mt-0.5 block truncate text-[14px] text-muted-foreground group-data-selected/item:text-white/80">Apple Account, iCloud, and more</span>
                  </span>
                  <Disclosure />
                </SplitViewItem>
              </div>
              {GROUPS.map((g, i) => (
                <div key={i} className="mb-5 overflow-hidden rounded-[12px] bg-card">
                  {g.map((r, j) => (r.t === 'link' ? <IosItem key={r.to} row={r} /> : <RowView key={j} row={r} />))}
                </div>
              ))}
            </>
          )}
        </div>
      </SplitViewContent>
    </SplitViewSidebar>
  );
}

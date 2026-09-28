/* iPhone: a NavigationStack. The root is the large-title Settings list with search; every drill-down pushes. */
import { Avatar, ListRow, ListSection, NavigationStack, SearchField, type Screen } from '@brett_lamy/ui';
import { ACCOUNT, GROUPS, getPane } from './data';
import { PaneView, RowView, SearchResults } from './rows';
import { useSettings } from './state';

function RootList() {
  const s = useSettings();
  return (
    <div className="px-4 pt-3">
      <ListSection>
        <ListRow leading={<Avatar c={{ f: ACCOUNT.first, l: ACCOUNT.last }} size={58} />} onPress={() => s.open('account')} accessory="chevron" divider={false}
          title={<span className="text-[20px] font-semibold">{ACCOUNT.first} {ACCOUNT.last}</span>} subtitle="Apple Account, iCloud, and more" className="[&_button]:py-1.5" />
      </ListSection>
      {GROUPS.map((g, i) => (
        <ListSection key={i}>{g.map((r, j) => <RowView key={j} row={r} last={j === g.length - 1} />)}</ListSection>
      ))}
    </div>
  );
}

export function PhoneSettings() {
  const s = useSettings();
  const screens: Screen[] = [
    {
      key: 'root', title: 'Settings', largeTitle: true, grouped: true, hideChromeOnScroll: false,
      subheader: <SearchField value={s.query} onChange={s.setQuery} aria-label="Search settings" />,
      content: s.query ? <div className="px-4 pt-3"><SearchResults /></div> : <RootList />,
    },
    ...s.path.map((id, i): Screen => ({
      key: s.path.slice(0, i + 1).join('/'), title: getPane(id)?.title, grouped: true, hideChromeOnScroll: false, content: <PaneView id={id} />,
    })),
  ];
  return <NavigationStack screens={screens} onPop={s.back} />;
}

/* Apple Music clone — Listen Now, Browse, Radio, Search and the Library (Recently Added, Artists, Albums,
   Songs, playlists), album / artist / playlist pages, and a player that is one element: the mini player
   springs open into the full Now Playing screen (scrubber, transport, volume, lyrics, up next) and folds back.
   Wide: a SplitView sidebar beside a pushed detail stack. Phone: the iOS tab bar with the mini player above it.
   All artists, albums and songs are invented; artwork is generated. */
import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { MorphGroup, MorphPresence } from '@/components/ui/morph';
import { NavigationStack } from '@/components/ui/navigation-stack';
import { SplitView, SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewSidebar, SplitViewStack, SplitViewToggle, useSplitView, useSplitViewStack } from '@/components/ui/split-view';
import { TabView, TabViewBar, TabViewList, TabViewPanel, TabViewPanels, TabViewTab } from '@/components/ui/tab-view';
import { useContainerSize } from '@/lib/container';
import { Icon, type IconName } from '@/lib/icon';
import { BLProvider, useAppearance } from '@/lib/theme';
import { ALBUM, albumSongs } from './data';
import { FullPlayer, MiniPlayer } from './now-playing';
import { usePlayer } from './player';
import { MusicContext, PageView, isDetail, pageKey, pageTitle, screensFor, type Ctx, type Page } from './screens';
import { MusicSidebar } from './sidebar';

export type MusicSection = 'listen' | 'browse' | 'radio' | 'search' | 'library' | 'recent' | 'artists' | 'albums' | 'songs';

export interface AppleMusicProps {
  /** Where to open (a sidebar item; on phones, the tab that holds it). Defaults to Listen Now. */
  initialSection?: MusicSection;
  /** An album to open on top of the section, e.g. 'neon-tidewater'. */
  initialAlbum?: string;
  /** Start with the full Now Playing screen open. */
  nowPlaying?: boolean;
}

type Tab = 'listen' | 'browse' | 'radio' | 'library' | 'search';
const TABS: { id: Tab; title: string; icon: IconName }[] = [
  { id: 'listen', title: 'Listen Now', icon: 'play-circle' },
  { id: 'browse', title: 'Browse', icon: 'grid' },
  { id: 'radio', title: 'Radio', icon: 'radiowaves' },
  { id: 'library', title: 'Library', icon: 'books-vertical' },
  { id: 'search', title: 'Search', icon: 'magnifyingglass' },
];
const TAB_BAR = 62;

const sectionPage = (id: string): Page =>
  id.startsWith('playlist:') ? { kind: 'playlist', id: id.slice(9) } : ({ kind: id } as Page);
const tabFor = (s: MusicSection): Tab => (s === 'listen' || s === 'browse' || s === 'radio' || s === 'search' ? s : 'library');

/** Music's accent red (light / dark). */
const MUSIC_TINT = { light: '#FA2D48', dark: '#FF375F' } as const;

export default function AppleMusic({ initialSection = 'listen', initialAlbum, nowPlaying = false }: AppleMusicProps) {
  const dark = useAppearance() === 'dark';
  const [ref, box] = useContainerSize<HTMLDivElement>();
  const phone = box.width < 640;
  const player = usePlayer(initialAlbum ? { queue: albumSongs(ALBUM[initialAlbum]), index: 0, position: 48 } : undefined);
  const [expanded, setExpanded] = useState(nowPlaying);
  const env = { player, dark, wide: !phone && box.width >= 900 };

  const mini = (className: string, style?: CSSProperties) => (
    <MorphPresence mode="sync">
      {expanded ? null : <MiniPlayer key="mini" player={player} phone={phone} onOpen={() => setExpanded(true)} className={className} style={style} />}
    </MorphPresence>
  );

  return (
    <BLProvider dark={dark} tint={MUSIC_TINT[dark ? 'dark' : 'light']} className="bg-background">
      <MorphGroup>
        <div ref={ref} className="relative h-full w-full">
          {phone ? (
            <>
              <PhoneTabs env={env} initialSection={initialSection} initialAlbum={initialAlbum} />
              {mini('inset-x-2', { bottom: TAB_BAR + 8 })}
            </>
          ) : (
            <SplitView aria-label="Music" defaultSelection={{ sidebar: initialSection === 'library' ? 'recent' : initialSection }}>
              <SplitViewSidebar width={260} resizable={false}>
                <MusicSidebar />
              </SplitViewSidebar>
              <SplitViewDetail>
                {/* Each stack page provides its own `open` (a push labelled with its title). */}
                <MusicContext.Provider value={{ ...env, open: () => undefined }}>
                  <Detail initialAlbum={initialAlbum} />
                </MusicContext.Provider>
                {mini('inset-x-5 bottom-4 mx-auto max-w-[640px]')}
              </SplitViewDetail>
            </SplitView>
          )}
          <MorphPresence mode="sync">
            {expanded ? <FullPlayer key="full" player={player} phone={phone} height={box.height} onClose={() => setExpanded(false)} /> : null}
          </MorphPresence>
        </div>
      </MorphGroup>
    </BLProvider>
  );
}

/** Phone: the iOS tab bar; every tab keeps its own NavigationStack. */
function PhoneTabs({ env, initialSection, initialAlbum }: { env: Omit<Ctx, 'open'>; initialSection: MusicSection; initialAlbum?: string }) {
  const [tab, setTab] = useState<Tab>(tabFor(initialSection));
  const [stacks, setStacks] = useState<Record<Tab, Page[]>>(() => {
    const s = { listen: [{ kind: 'listen' }], browse: [{ kind: 'browse' }], radio: [{ kind: 'radio' }], library: [{ kind: 'library' }], search: [{ kind: 'search' }] } as Record<Tab, Page[]>;
    const t = tabFor(initialSection);
    if (t === 'library' && initialSection !== 'library') s.library.push({ kind: initialSection } as Page);
    if (initialAlbum) s[t].push({ kind: 'album', id: initialAlbum });
    return s;
  });
  const ctx: Ctx = { ...env, open: (page) => setStacks((s) => ({ ...s, [tab]: [...s[tab], page] })) };
  return (
    <MusicContext.Provider value={ctx}>
      <TabView selectedKey={tab} onSelectionChange={(k) => setTab(k as Tab)} className="absolute inset-0">
        <TabViewBar hideOnScroll={false}>
          <TabViewList aria-label="Music">
            {TABS.map((t) => (
              <TabViewTab key={t.id} id={t.id} textValue={t.title}>
                <Icon name={t.icon} size={25} />
                <span className="text-[10px] font-semibold tracking-[.1px]">{t.title}</span>
              </TabViewTab>
            ))}
          </TabViewList>
        </TabViewBar>
        <TabViewPanels>
          {TABS.map((t) => (
            <TabViewPanel key={t.id} id={t.id} shouldForceMount className="overflow-hidden">
              <NavigationStack screens={screensFor(stacks[t.id], TAB_BAR + 64)}
                onPop={() => setStacks((s) => ({ ...s, [t.id]: s[t.id].slice(0, -1) }))} />
            </TabViewPanel>
          ))}
        </TabViewPanels>
      </TabView>
    </MusicContext.Provider>
  );
}

/** Wide: the sidebar picks a section; albums, artists and playlists push onto a stack in the detail column. */
function Detail({ initialAlbum }: { initialAlbum?: string }) {
  const section = useSplitView().selection.sidebar ?? 'listen';
  return (
    <SplitViewStack resetKey={section}>
      <StackPage page={sectionPage(section)} initialAlbum={initialAlbum} />
    </SplitViewStack>
  );
}

function StackPage({ page, back, initialAlbum }: { page: Page; back?: string; initialAlbum?: string }) {
  const stack = useSplitViewStack();
  const env = useContext(MusicContext)!;
  const title = pageTitle(page);
  const detail = isDetail(page);
  const ctx: Ctx = { ...env, open: (p) => stack.push(<StackPage page={p} back={title} />, { key: pageKey(p) }) };
  const opened = useRef(false);
  useEffect(() => {
    if (initialAlbum && !opened.current) { opened.current = true; ctx.open({ kind: 'album', id: initialAlbum }); }
  }, [initialAlbum, ctx]);
  return (
    <MusicContext.Provider value={ctx}>
      {/* Detail pages keep their title in the page itself, as Music does; the bar is just the back button. */}
      <SplitViewHeader title={detail ? undefined : title} largeTitle={!detail} backLabel={back} leading={<SplitViewToggle />}
        className={detail ? 'shadow-none' : undefined} />
      <SplitViewContent>
        <div className="mx-auto max-w-[1180px] pb-24"><PageView page={page} /></div>
      </SplitViewContent>
    </MusicContext.Provider>
  );
}

/* Apple Music clone — Listen Now, Browse, Radio, Search and the Library (Recently Added, Artists, Albums,
   Songs, playlists), album / artist / playlist pages, and a player that is one element: the mini player
   springs open into the full Now Playing screen (scrubber, transport, volume, lyrics, up next) and folds back.
   Wide: a SplitView sidebar beside a pushed detail stack. Phone: the iOS tab bar with the mini player above it.
   All artists, albums and songs are invented; artwork is generated. */
import { useContext, useEffect, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { MorphGroup, MorphPresence } from '@/components/ui/morph';
import { NavigationStack } from '@/components/ui/navigation-stack';
import { SplitView, SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewSidebar, SplitViewStack, SplitViewToggle, useSplitViewStack } from '@/components/ui/split-view';
import { Tabs, TabsBar, TabsList, TabsPanel, TabsPanels, TabsTab } from '@/components/ui/tabs';
import { useContainerSize } from '@/lib/container';
import { sizeClassOf } from '@/lib/size-class';
import type { IconName } from '@/lib/icon';
import { BLProvider, useAppearance } from '@/lib/theme';
import { ALBUM, albumSongs } from './data';
import { FullPlayer, MiniPlayer } from './now-playing';
import { usePlayer } from './player';
import { MusicContext, MusicPage, PageView, isDetail, pageKey, pageOfKey, pageTitle, stackKey, type Ctx, type Page } from './screens';
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
const tabFor = (s: string): Tab => (s === 'listen' || s === 'browse' || s === 'radio' || s === 'search' ? s : 'library');
const LIBRARY_SECTIONS = new Set(['recent', 'artists', 'albums', 'songs', 'playlist']);

/* Where you are, in one shape both layouts read and write, so crossing the compact boundary keeps the place: the
   tab on top and each tab's page stack, root first. The wide layout sees the same place as a sidebar section plus
   the pages pushed over it (a Library tab's second page is the section, as the sidebar lists them). */
type Stacks = Record<Tab, Page[]>;
interface Nav { tab: Tab; stacks: Stacks }

function initialNav(section: MusicSection, album?: string): Nav {
  const stacks: Stacks = { listen: [{ kind: 'listen' }], browse: [{ kind: 'browse' }], radio: [{ kind: 'radio' }], library: [{ kind: 'library' }], search: [{ kind: 'search' }] };
  const tab = tabFor(section);
  if (tab === 'library' && section !== 'library') stacks.library.push({ kind: section } as Page);
  if (album) stacks[tab].push({ kind: 'album', id: album });
  return { tab, stacks };
}

function wideOf({ tab, stacks }: Nav): { section: string; pages: Page[] } {
  const stack = stacks[tab];
  if (tab !== 'library') return { section: tab, pages: stack.slice(1) };
  const top = stack[1];
  if (top && LIBRARY_SECTIONS.has(top.kind)) return { section: top.kind === 'playlist' ? `playlist:${top.id}` : top.kind, pages: stack.slice(2) };
  return { section: 'recent', pages: stack.slice(1) };
}

function fromWide(nav: Nav, section: string, pages: Page[]): Nav {
  // The wide layout restoring the place `nav` already holds (as it mounts) leaves it as it is: a Library stack
  // opened on an album keeps its back button to the Library, not to the sidebar's section.
  const was = wideOf(nav);
  if (was.section === section && was.pages.map(pageKey).join() === pages.map(pageKey).join()) return nav;
  const tab = tabFor(section);
  const root: Page[] = tab === 'library' ? [{ kind: 'library' }, sectionPage(section)] : [{ kind: tab }];
  return { tab, stacks: { ...nav.stacks, [tab]: [...root, ...pages] } };
}

/** Music's accent red (light / dark). */
const MUSIC_TINT = { light: '#FA2D48', dark: '#FF375F' } as const;

export default function AppleMusic({ initialSection = 'listen', initialAlbum, nowPlaying = false }: AppleMusicProps) {
  const dark = useAppearance() === 'dark';
  // Pixels, not just the size class: the full player fits its artwork to the height, and 900px wide shows more.
  const [ref, box] = useContainerSize<HTMLDivElement>();
  const sizeClass = sizeClassOf(box.width);
  const phone = sizeClass === 'compact';
  const player = usePlayer(initialAlbum ? { queue: albumSongs(ALBUM[initialAlbum]), index: 0, position: 48 } : undefined);
  const [expanded, setExpanded] = useState(nowPlaying);
  const [nav, setNav] = useState(() => initialNav(initialSection, initialAlbum));
  const env = { player, dark, wide: !phone && box.width >= 900 };

  const mini = (className: string, style?: CSSProperties) => (
    <MorphPresence mode="sync">
      {expanded ? null : <MiniPlayer key="mini" player={player} phone={phone} onOpen={() => setExpanded(true)} className={className} style={style} />}
    </MorphPresence>
  );

  return (
    <BLProvider dark={dark} tint={MUSIC_TINT[dark ? 'dark' : 'light']} className="bg-background">
      <MorphGroup>
        {/* Popups opened in it present for its size, not the window's: BLProvider's root, the same box, is the
            size-class scope they follow. */}
        <div ref={ref} className="relative h-full w-full">
          {phone ? (
            <>
              <PhoneTabs env={env} nav={nav} setNav={setNav} />
              {mini('inset-x-2', { bottom: TAB_BAR + 8 })}
            </>
          ) : (
            <Wide env={env} nav={nav} setNav={setNav}>{mini('inset-x-5 bottom-4 mx-auto max-w-[640px]')}</Wide>
          )}
          {/* Now Playing is a Dialog (focus moves in and comes back to the mini player, Esc closes it, the app
              behind is inert) whose content is the morphing player. */}
          <Dialog open={expanded} onOpenChange={setExpanded} presentation="dialog">
            <FullPlayer player={player} phone={phone} height={box.height}
              onClose={() => setExpanded(false)} finalFocus={() => ref.current?.querySelector<HTMLElement>('[data-now-playing-open]') ?? null} />
          </Dialog>
        </div>
      </MorphGroup>
    </BLProvider>
  );
}

type SetNav = Dispatch<SetStateAction<Nav>>;

/** Phone: the iOS tab bar; every tab keeps its own NavigationStack. */
function PhoneTabs({ env, nav, setNav }: { env: Omit<Ctx, 'open'>; nav: Nav; setNav: SetNav }) {
  const { tab, stacks } = nav;
  const ctx: Ctx = { ...env, open: (page) => setNav((n) => ({ ...n, stacks: { ...n.stacks, [n.tab]: [...n.stacks[n.tab], page] } })) };
  return (
    <MusicContext.Provider value={ctx}>
      <Tabs<Tab> variant="bar" value={tab} onValueChange={(k) => { if (k) setNav((n) => ({ ...n, tab: k })); }} className="absolute inset-0">
        <TabsBar hideOnScroll={false}>
          <TabsList aria-label="Music">
            {TABS.map((t) => (
              <TabsTab key={t.id} value={t.id} icon={t.icon}>{t.title}</TabsTab>
            ))}
          </TabsList>
        </TabsBar>
        <TabsPanels>
          {TABS.map((t) => (
            <TabsPanel key={t.id} value={t.id} keepMounted className="overflow-hidden">
              <NavigationStack bottomInset={TAB_BAR + 64} pages={stacks[t.id].map(stackKey)}
                onPagesChange={(next) => setNav((n) => ({ ...n, stacks: { ...n.stacks, [t.id]: n.stacks[t.id].slice(0, next.length) } }))}>
                {stacks[t.id].map((page, i) => <MusicPage key={stackKey(page, i)} value={stackKey(page, i)} page={page} />)}
              </NavigationStack>
            </TabsPanel>
          ))}
        </TabsPanels>
      </Tabs>
    </MusicContext.Provider>
  );
}

/** Wide: the sidebar picks a section; albums, artists and playlists push onto a stack in the detail column. The
    stack's own page keys are the record of what is open (pushes, back, Esc, a swipe), so `nav` follows it. */
function Wide({ env, nav, setNav, children }: { env: Omit<Ctx, 'open'>; nav: Nav; setNav: SetNav; children: ReactNode }) {
  const { section, pages } = wideOf(nav);
  return (
    <SplitView aria-label="Music" value={{ sidebar: section }}
      onValueChange={(v) => { if (v.sidebar) setNav((n) => fromWide(n, v.sidebar!, [])); }}>
      <SplitViewSidebar width={260} resizable={false}>
        <MusicSidebar />
      </SplitViewSidebar>
      <SplitViewDetail>
        {/* Each stack page provides its own `open` (a push labelled with its title). */}
        <MusicContext.Provider value={{ ...env, open: () => undefined }}>
          <SplitViewStack resetKey={section}
            onPagesChange={(keys) => setNav((n) => fromWide(n, wideOf(n).section, keys.slice(1).map(pageOfKey)))}>
            <StackPage page={sectionPage(section)} restore={pages} />
          </SplitViewStack>
        </MusicContext.Provider>
        {children}
      </SplitViewDetail>
    </SplitView>
  );
}

/** A page of the wide stack. The root one gets `restore`: the pages that were open when the layout mounted (the
    phone layout's, after a resize), pushed back on top of it. */
function StackPage({ page, back, restore }: { page: Page; back?: string; restore?: Page[] }) {
  const stack = useSplitViewStack();
  const env = useContext(MusicContext)!;
  const title = pageTitle(page);
  const detail = isDetail(page);
  const ctx: Ctx = { ...env, open: (p) => stack.push(<StackPage page={p} back={title} />, { key: pageKey(p) }) };
  const restoring = useRef(restore);
  useEffect(() => {
    const saved = restoring.current ?? [];
    restoring.current = undefined;
    saved.forEach((p, i) => stack.push(<StackPage page={p} back={pageTitle(i ? saved[i - 1] : page)} />, { key: pageKey(p) }));
    // Once, on mount: later pages come from `open`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

/* Apple Music clone — Listen Now, Browse, Radio, Search and the Library (Recently Added, Artists, Albums,
   Songs, playlists), album / artist / playlist pages, and a player that is one element: the mini player
   springs open into the full Now Playing screen (scrubber, transport, volume, lyrics, up next) and folds back.
   Wide: a SplitView sidebar beside a pushed detail stack. Phone: the iOS tab bar with the mini player above it.
   All artists, albums and songs are invented; artwork is generated. */
import { useLayoutEffect, useRef, useState } from 'react';
import {
  BLProvider, NavigationStack, SplitView, SplitViewDetail, SplitViewSidebar, SplitViewToggle, TabView, TabViewBar, TabViewList,
  TabViewPanel, TabViewPanels, TabViewTab, useAppearance, type SplitViewSelection,
} from '@brett_lamy/ui';
import { ALBUM, albumSongs } from './data';
import { Glyph, type GlyphName } from './glyphs';
import { NowPlaying, type Rect } from './now-playing';
import { usePlayer } from './player';
import { screensFor, type Ctx, type Page } from './screens';
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
const TABS: { id: Tab; title: string; icon: GlyphName }[] = [
  { id: 'listen', title: 'Listen Now', icon: 'listen' },
  { id: 'browse', title: 'Browse', icon: 'browse' },
  { id: 'radio', title: 'Radio', icon: 'radio' },
  { id: 'library', title: 'Library', icon: 'library' },
  { id: 'search', title: 'Search', icon: 'search' },
];
const TAB_BAR = 62;
const SIDEBAR = 260;

const sectionPage = (id: string): Page =>
  id.startsWith('playlist:') ? { kind: 'playlist', id: id.slice(9) } : ({ kind: id } as Page);
const tabFor = (s: MusicSection): Tab => (s === 'listen' || s === 'browse' || s === 'radio' || s === 'search' ? s : 'library');

export default function AppleMusic({ initialSection = 'listen', initialAlbum, nowPlaying = false }: AppleMusicProps) {
  const dark = useAppearance() === 'dark';
  const [ref, box] = useBox();
  const phone = box.width < 640;
  const player = usePlayer(initialAlbum ? { queue: albumSongs(ALBUM[initialAlbum]), index: 0, position: 48 } : undefined);
  const [expanded, setExpanded] = useState(nowPlaying);
  const albumPage: Page[] = initialAlbum ? [{ kind: 'album', id: initialAlbum }] : [];

  // Wide: the sidebar picks a section; pages push on top of it in the detail column.
  const [section, setSection] = useState<string>(initialSection === 'library' ? 'recent' : initialSection);
  const [stack, setStack] = useState<Page[]>(() => [sectionPage(section), ...albumPage]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [widthClass, setWidthClass] = useState('regular');

  // Phone: every tab keeps its own stack.
  const [tab, setTab] = useState<Tab>(tabFor(initialSection));
  const [stacks, setStacks] = useState<Record<Tab, Page[]>>(() => {
    const s = { listen: [{ kind: 'listen' }], browse: [{ kind: 'browse' }], radio: [{ kind: 'radio' }], library: [{ kind: 'library' }], search: [{ kind: 'search' }] } as Record<Tab, Page[]>;
    const t = tabFor(initialSection);
    if (t === 'library' && initialSection !== 'library') s.library.push({ kind: initialSection } as Page);
    s[t].push(...albumPage);
    return s;
  });

  const ctx: Ctx = {
    player, dark, wide: !phone && box.width >= 900,
    open: (page) => (phone ? setStacks((s) => ({ ...s, [tab]: [...s[tab], page] })) : setStack((s) => [...s, page])),
  };

  const mini: Rect = phone
    ? { left: 8, top: box.height - TAB_BAR - 8 - 56, width: box.width - 16, height: 56 }
    : (() => {
        const left0 = widthClass === 'regular' && sidebarOpen ? SIDEBAR : 0;
        const room = box.width - left0;
        const width = Math.min(640, room - 40);
        return { left: left0 + (room - width) / 2, top: box.height - 16 - 64, width, height: 64 };
      })();

  return (
    <BLProvider dark={dark} tint={dark ? '#FF375F' : '#FA2D48'} className="bg-bl-bg **:box-border">
      <div ref={ref} className="relative h-full w-full">
        {phone ? (
          <TabView selectedKey={tab} onSelectionChange={(k) => setTab(k as Tab)} className="absolute inset-0">
            <TabViewBar hideOnScroll={false}>
              <TabViewList aria-label="Music">
                {TABS.map((t) => (
                  <TabViewTab key={t.id} id={t.id} textValue={t.title}>
                    <Glyph name={t.icon} size={25} />
                    <span className="text-[10px] font-semibold tracking-[.1px]">{t.title}</span>
                  </TabViewTab>
                ))}
              </TabViewList>
            </TabViewBar>
            <TabViewPanels>
              {TABS.map((t) => (
                <TabViewPanel key={t.id} id={t.id} shouldForceMount className="overflow-hidden">
                  <NavigationStack screens={screensFor(stacks[t.id], ctx, undefined, TAB_BAR + 64)}
                    onPop={() => setStacks((s) => ({ ...s, [t.id]: s[t.id].slice(0, -1) }))} />
                </TabViewPanel>
              ))}
            </TabViewPanels>
          </TabView>
        ) : (
          <SplitView aria-label="Music" selection={{ sidebar: section } as SplitViewSelection}
            onSelectionChange={(s) => { const id = s.sidebar ?? 'listen'; setSection(id); setStack([sectionPage(id)]); }}
            onWidthClassChange={(wc) => { setWidthClass(wc); setSidebarOpen(wc === 'regular'); }}
            onSidebarVisibleChange={setSidebarOpen}>
            <SplitViewSidebar width={SIDEBAR} resizable={false}>
              <MusicSidebar />
            </SplitViewSidebar>
            <SplitViewDetail>
              <NavigationStack screens={screensFor(stack, ctx, <SplitViewToggle />, 96)} onPop={() => setStack((s) => s.slice(0, -1))} />
            </SplitViewDetail>
          </SplitView>
        )}
        <NowPlaying player={player} box={box} mini={mini} phone={phone} expanded={expanded} onExpandedChange={setExpanded} />
      </div>
    </BLProvider>
  );
}

/** The block's own width and height (it adapts to its box, not the window). */
function useBox() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 1200, height: 800 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (width: number, height: number) => { if (width > 0) setBox({ width, height }); };
    apply(el.offsetWidth, el.offsetHeight);
    const ro = new ResizeObserver(([e]) => apply(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

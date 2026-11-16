/* Apple Music clone — Listen Now, Browse, Radio, Search and the Library (Recently Added, Artists, Albums,
   Songs, playlists), album / artist / playlist pages, and a player that is one element: the mini player
   springs open into the full Now Playing screen (scrubber, transport, volume, lyrics, up next) and folds back.
   One SplitView at every size: a sidebar beside a pushed detail stack, and on a phone the same sidebar as the iOS
   tab bar (`compactPresentation="tabs"`), with the mini player above it. The Library tab is the sidebar's Library
   section, which the SplitView shows as that tab's first page. Nothing remounts across the boundary.
   All artists, albums and songs are invented; artwork is generated. */
import { useRef, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { MorphGroup, MorphPresence } from '@/components/ui/morph';
import { NavigationStack } from '@/components/ui/navigation-stack';
import { createSplitViewController, SplitView, SplitViewDetail, SplitViewSidebar, SplitViewSidebarTrigger, useSplitView } from '@/components/ui/split-view';
import { useContainerSize } from '@/lib/container';
import { BLProvider, useAppearance } from '@/lib/theme';
import { ALBUM, albumSongs } from './data';
import { FullPlayer, MiniPlayer } from './now-playing';
import { usePlayer } from './player';
import { MusicContext, MusicPage, stackKey, type Ctx, type Page } from './screens';
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

/** The detail's first page for a sidebar value. The Library tab itself (on a phone, the Library rows) shows its
 *  Recently Added behind them, which is what a wider window shows for it. */
const sectionPage = (id: string): Page =>
  id.startsWith('playlist:') ? { kind: 'playlist', id: id.slice(9) } : id === 'library' ? { kind: 'recent' } : ({ kind: id } as Page);

/** The tab a sidebar value is in on a phone: the Library section's rows are the Library tab. */
const LIBRARY_ROWS = new Set(['library', 'recent', 'artists', 'albums', 'songs']);
const tabOf = (id: string) => (LIBRARY_ROWS.has(id) || id.startsWith('playlist:') ? 'library' : id);

/** Music's accent red (light / dark). */
const MUSIC_TINT = { light: '#FA2D48', dark: '#FF375F' } as const;

export default function AppleMusic({ initialSection = 'listen', initialAlbum, nowPlaying = false }: AppleMusicProps) {
  const dark = useAppearance() === 'dark';
  // The full player fits its artwork to the block's height.
  const [ref, box] = useContainerSize<HTMLDivElement>();
  const player = usePlayer(initialAlbum ? { queue: albumSongs(ALBUM[initialAlbum]), index: 0, position: 48 } : undefined);
  const [expanded, setExpanded] = useState(nowPlaying);
  // Where you are: the sidebar section (on a phone, the tab that holds it) and the pages pushed over it. Each section
  // keeps its own pages and the Library tab its last row, so going back to a tab lands where you left it, as iOS
  // keeps each tab's stack.
  const [section, setSection] = useState<string>(initialSection);
  const [pagesBy, setPagesBy] = useState<Record<string, Page[]>>(() => (initialAlbum ? { [initialSection]: [{ kind: 'album', id: initialAlbum }] } : {}));
  const lastInLibrary = useRef<string>(tabOf(initialSection) === 'library' ? initialSection : 'library');
  const pages = pagesBy[section] ?? [];
  const setPages = (change: (pages: Page[]) => Page[]) => setPagesBy((all) => ({ ...all, [section]: change(all[section] ?? []) }));
  const [split] = useState(createSplitViewController);
  const pick = (next: string) => {
    if (tabOf(next) !== tabOf(section)) {
      // Another tab: back to where it was (in Library, the row last open, over the Library rows).
      const restored = tabOf(next) === 'library' ? lastInLibrary.current : next;
      setSection(restored);
      if (restored !== next) queueMicrotask(() => split.show('detail'));
      return;
    }
    // A row of this tab, or its tab pressed again: that row's first page.
    if (tabOf(next) === 'library') lastInLibrary.current = next;
    setPagesBy((all) => ({ ...all, [next]: [] }));
    setSection(next);
  };
  const ctx: Ctx = { player, dark, open: (page) => setPages((p) => [...p, page]) };
  const all = [sectionPage(section), ...pages];

  return (
    <BLProvider appearance={dark ? 'dark' : 'light'} tint={MUSIC_TINT[dark ? 'dark' : 'light']} className="bg-background">
      <MorphGroup>
        {/* Popups opened in it present for its size, not the window's: BLProvider's root, the same box, is the
            size-class scope they follow. */}
        <div ref={ref} className="relative h-full w-full">
          <SplitView aria-label="Music" controller={split} value={{ sidebar: section }}
            onValueChange={(v) => { if (v.sidebar) pick(v.sidebar); }}>
            <SplitViewSidebar width={260} resizable={false} compactPresentation="tabs" aria-label="Music">
              <MusicSidebar />
            </SplitViewSidebar>
            <SplitViewDetail>
              <MusicContext.Provider value={ctx}>
                <DetailStack pages={all} onPop={(n) => setPages((p) => p.slice(0, n - 1))} />
              </MusicContext.Provider>
              <Mini in="detail" hidden={expanded} player={player} onOpen={() => setExpanded(true)} />
            </SplitViewDetail>
            <Mini in="root" hidden={expanded} player={player} onOpen={() => setExpanded(true)} />
            {/* Now Playing is a Dialog (focus moves in and comes back to the mini player, Esc closes it, the app
                behind is inert) whose content is the morphing player. */}
            <NowPlaying open={expanded} onOpenChange={setExpanded} player={player} height={box.height}
              finalFocus={() => ref.current?.querySelector<HTMLElement>('[data-now-playing-open]') ?? null} />
          </SplitView>
        </div>
      </MorphGroup>
    </BLProvider>
  );
}

/** The first page keeps one key for every section, so picking another section pops the pages over it. */
const keyOf = (p: Page, i: number) => (i === 0 ? 'section' : stackKey(p, i));

/** The detail column's stack: the section, and the pages pushed over it. Under a Library row on a phone its first
 *  page goes back to the Library rows by itself (the SplitView's column before). */
function DetailStack({ pages, onPop }: { pages: Page[]; onPop: (length: number) => void }) {
  const phone = useSplitView().collapsed;
  return (
    // The mini player rides over the content: keep room for it under the last rows.
    <NavigationStack pages={pages.map(keyOf)} bottomInset={phone ? 64 : 68} onPagesChange={(keys) => onPop(keys.length)}>
      {pages.map((page, i) => (
        <MusicPage key={keyOf(page, i)} value={keyOf(page, i)} page={page} leading={i === 0 ? <SplitViewSidebarTrigger /> : undefined} maxWidth={1180} />
      ))}
    </NavigationStack>
  );
}

function NowPlaying({ open, onOpenChange, player, height, finalFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; player: Ctx['player']; height: number; finalFocus: () => HTMLElement | null;
}) {
  const phone = useSplitView().collapsed;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} presentation="dialog">
      <FullPlayer player={player} phone={phone} height={height} onClose={() => onOpenChange(false)} finalFocus={finalFocus} />
    </Dialog>
  );
}

/** The mini player: on a phone, over the tab bar and every tab's page (`--tabs-bar-h`, which the SplitView publishes
    while its sidebar is the tab bar), so it is drawn by the SplitView's root (`in="root"`); otherwise a floating card
    at the bottom of the detail column (`in="detail"`). It morphs from one place to the other at the boundary. */
function Mini({ in: place, hidden, player, onOpen }: { in: 'root' | 'detail'; hidden: boolean; player: Ctx['player']; onOpen: () => void }): ReactNode {
  const phone = useSplitView().collapsed;
  return (
    <MorphPresence mode="sync">
      {hidden || (place === 'root') !== phone ? null : (
        <MiniPlayer key="mini" player={player} phone={phone} onOpen={onOpen}
          className={phone ? 'inset-x-2 bottom-[calc(var(--tabs-bar-h,0px)+8px)]' : 'inset-x-5 bottom-4 mx-auto max-w-[640px]'} />
      )}
    </MorphPresence>
  );
}

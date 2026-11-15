/* Apple Music clone — Listen Now, Browse, Radio, Search and the Library (Recently Added, Artists, Albums,
   Songs, playlists), album / artist / playlist pages, and a player that is one element: the mini player
   springs open into the full Now Playing screen (scrubber, transport, volume, lyrics, up next) and folds back.
   One SplitView at every size: a sidebar beside a pushed detail stack, and on a phone the same sidebar as the iOS
   tab bar (`compactPresentation="tabs"`), with the mini player above it. Nothing remounts across the boundary.
   All artists, albums and songs are invented; artwork is generated. */
import { useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { MorphGroup, MorphPresence } from '@/components/ui/morph';
import { NavigationStack } from '@/components/ui/navigation-stack';
import { SplitView, SplitViewDetail, SplitViewSidebar, SplitViewSidebarTrigger } from '@/components/ui/split-view';
import { useContainerSize } from '@/lib/container';
import { sizeClassOf } from '@/lib/size-class';
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

const sectionPage = (id: string): Page =>
  id.startsWith('playlist:') ? { kind: 'playlist', id: id.slice(9) } : ({ kind: id } as Page);
/** The sidebar sections the phone's Library tab holds: on a phone the Library page sits under them. */
const inLibrary = (section: string) => ['recent', 'artists', 'albums', 'songs'].includes(section) || section.startsWith('playlist:');

/** Music's accent red (light / dark). */
const MUSIC_TINT = { light: '#FA2D48', dark: '#FF375F' } as const;

export default function AppleMusic({ initialSection = 'listen', initialAlbum, nowPlaying = false }: AppleMusicProps) {
  const dark = useAppearance() === 'dark';
  // Pixels, not just the size class: the full player fits its artwork to the height, and 900px wide shows more.
  const [ref, box] = useContainerSize<HTMLDivElement>();
  const phone = sizeClassOf(box.width) === 'compact';
  const player = usePlayer(initialAlbum ? { queue: albumSongs(ALBUM[initialAlbum]), index: 0, position: 48 } : undefined);
  const [expanded, setExpanded] = useState(nowPlaying);
  // Where you are: the sidebar section (on a phone, the tab that holds it) and the pages pushed over it.
  const [section, setSection] = useState<string>(initialSection);
  const [pages, setPages] = useState<Page[]>(() => (initialAlbum ? [{ kind: 'album', id: initialAlbum }] : []));
  const env = { player, dark, wide: !phone && box.width >= 900 };
  const ctx: Ctx = { ...env, open: (page) => setPages((p) => [...p, page]) };

  // The stack's first pages: the section, and on a phone the Library page under a Library section.
  const roots: Page[] = phone && inLibrary(section) ? [{ kind: 'library' }, sectionPage(section)] : [sectionPage(section)];
  const all = [...roots, ...pages];
  // The first page keeps one key for every section, so picking another section pops the pages over it.
  const keyOf = (p: Page, i: number) => (i === 0 ? 'section' : stackKey(p, i));

  return (
    <BLProvider dark={dark} tint={MUSIC_TINT[dark ? 'dark' : 'light']} className="bg-background">
      <MorphGroup>
        {/* Popups opened in it present for its size, not the window's: BLProvider's root, the same box, is the
            size-class scope they follow. */}
        <div ref={ref} className="relative h-full w-full">
          <SplitView aria-label="Music" value={{ sidebar: section }}
            onValueChange={(v) => { if (v.sidebar) { setSection(v.sidebar); setPages([]); } }}>
            <SplitViewSidebar width={260} resizable={false} compactPresentation="tabs" aria-label="Music">
              <MusicSidebar />
            </SplitViewSidebar>
            <SplitViewDetail>
              <MusicContext.Provider value={ctx}>
                {/* The mini player rides over the content: keep room for it under the last rows. */}
                <NavigationStack pages={all.map(keyOf)} bottomInset={phone ? 64 : 68}
                  onPagesChange={(keys) => {
                    // Back from a Library section, on a phone, lands on the Library page: the Library tab.
                    if (keys.length < roots.length) { setSection('library'); setPages([]); }
                    else setPages((p) => p.slice(0, keys.length - roots.length));
                  }}>
                  {all.map((page, i) => (
                    <MusicPage key={keyOf(page, i)} value={keyOf(page, i)} page={page} leading={i === 0 ? <SplitViewSidebarTrigger /> : undefined} maxWidth={1180} />
                  ))}
                </NavigationStack>
              </MusicContext.Provider>
              <Mini phone={phone} hidden={expanded} player={player} onOpen={() => setExpanded(true)} />
            </SplitViewDetail>
          </SplitView>
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

/** The mini player: over the tab bar on a phone (`--tabs-bar-h`, which the SplitView publishes while its sidebar is
    the tab bar), a floating card at the bottom of the detail column otherwise. */
function Mini({ phone, hidden, player, onOpen }: { phone: boolean; hidden: boolean; player: Ctx['player']; onOpen: () => void }): ReactNode {
  return (
    <MorphPresence mode="sync">
      {hidden ? null : (
        <MiniPlayer key="mini" player={player} phone={phone} onOpen={onOpen}
          className={phone ? 'inset-x-2 bottom-[calc(var(--tabs-bar-h,0px)+8px)]' : 'inset-x-5 bottom-4 mx-auto max-w-[640px]'} />
      )}
    </MorphPresence>
  );
}

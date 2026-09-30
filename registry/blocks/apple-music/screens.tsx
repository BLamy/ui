/* Every screen the app pushes: Listen Now, Browse, Radio, Search, the Library and its sections, and the album,
   artist and playlist pages. `PageView` draws one; the phone's tabs push them as NavigationStack screens
   (`screensFor`) and the wide layout's detail column as SplitViewStack pages. Pages read the player and
   `open` from `MusicContext`, so a pushed page stays live. */
import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import { type Screen } from '@/components/ui/navigation-stack';
import { NowPlayingBars } from '@/components/ui/now-playing-bars';
import { SearchField } from '@/components/ui/search-field';
import { Icon, type IconName, type IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { ArtistArt, Artwork, PlaylistArt } from './artwork';
import {
  ALBUM, ALBUMS, ALL_SONGS, ARTISTS, PLAYLISTS, STATIONS, albumSongs, fmt, minutes, playlistSongs, type Album, type Song,
} from './data';
import type { Player } from './player';

export type Page =
  | { kind: 'listen' } | { kind: 'browse' } | { kind: 'radio' } | { kind: 'search' } | { kind: 'library' }
  | { kind: 'recent' } | { kind: 'artists' } | { kind: 'albums' } | { kind: 'songs' }
  | { kind: 'album'; id: string } | { kind: 'artist'; name: string } | { kind: 'playlist'; id: string };

export const pageKey = (p: Page) => ('id' in p ? `${p.kind}:${p.id}` : 'name' in p ? `artist:${p.name}` : p.kind);

const TITLES: Record<string, string> = {
  listen: 'Listen Now', browse: 'Browse', radio: 'Radio', search: 'Search', library: 'Library', recent: 'Recently Added',
  artists: 'Artists', albums: 'Albums', songs: 'Songs',
};
export function pageTitle(p: Page) {
  if (p.kind === 'album') return ALBUM[p.id].title;
  if (p.kind === 'playlist') return PLAYLISTS.find((x) => x.id === p.id)!.title;
  if (p.kind === 'artist') return p.name;
  return TITLES[p.kind];
}

export interface Ctx { player: Player; open: (p: Page) => void; wide: boolean; dark: boolean }
export const MusicContext = createContext<Ctx | null>(null);

export const isDetail = (p: Page) => p.kind === 'album' || p.kind === 'artist' || p.kind === 'playlist';

/** The album icon (a record in its sleeve) — drawn here; the library set has no album glyph. */
export const ALBUM_ICON: readonly IconShape[] = [{ r: [4, 4, 16, 16, 2.4] }, { c: [12, 12, 3.6] }, { c: [12, 12, 1], f: 1 }];

/** The phone's NavigationStack screens for one tab's stack of pages. */
export function screensFor(pages: Page[], bottomInset: number): Screen[] {
  return pages.map((page, i) => ({
    key: pageKey(page) + ':' + i,
    title: pageTitle(page),
    largeTitle: !isDetail(page),
    titleOnScroll: isDetail(page),
    hideChromeOnScroll: false,
    bottomInset,
    content: <PageView page={page} />,
  }));
}

export function PageView({ page }: { page: Page }) {
  const ctx = useContext(MusicContext)!;
  return <div className="@container"><PageBody page={page} ctx={ctx} /></div>;
}

function PageBody({ page, ctx }: { page: Page; ctx: Ctx }) {
  switch (page.kind) {
    case 'listen': return <ListenNow ctx={ctx} />;
    case 'browse': return <Browse ctx={ctx} />;
    case 'radio': return <Radio ctx={ctx} />;
    case 'search': return <Search ctx={ctx} />;
    case 'library': return <LibraryHome ctx={ctx} />;
    case 'recent': return <AlbumGrid albums={[...ALBUMS].sort((a, b) => a.added - b.added)} ctx={ctx} />;
    case 'albums': return <AlbumGrid albums={[...ALBUMS].sort((a, b) => a.title.localeCompare(b.title))} ctx={ctx} />;
    case 'artists': return <ArtistList ctx={ctx} />;
    case 'songs': return <SongList songs={ALL_SONGS} ctx={ctx} art />;
    case 'album': return <AlbumPage album={ALBUM[page.id]} ctx={ctx} />;
    case 'artist': return <ArtistPage name={page.name} ctx={ctx} />;
    case 'playlist': return <PlaylistPage id={page.id} ctx={ctx} />;
  }
}

/* ── Building blocks ── */

/** A labelled shelf that scrolls sideways, like every Apple Music home screen. */
function Shelf({ title, children, onMore }: { title: string; children: ReactNode; onMore?: () => void }) {
  return (
    <section aria-label={title} className="pt-5">
      <button type="button" onClick={onMore} disabled={!onMore}
        className="bl-btn flex items-center gap-1 border-0 bg-transparent px-4 pb-2.5 [font-family:inherit] text-[21px] font-bold tracking-[-.3px] text-foreground enabled:cursor-pointer">
        {title}{onMore ? <Icon name="chevron-right" size={17} weight="bold" className="text-muted-foreground" /> : null}
      </button>
      <div className="bl-scroll flex snap-x snap-mandatory scroll-px-4 gap-3.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{children}</div>
    </section>
  );
}

function AlbumTile({ album: a, ctx, size = 164, caption }: { album: Album; ctx: Ctx; size?: number; caption?: string }) {
  return (
    <button type="button" onClick={() => ctx.open({ kind: 'album', id: a.id })}
      className="bl-btn group shrink-0 snap-start cursor-pointer border-0 bg-transparent p-0 text-left [font-family:inherit] text-foreground"
      style={{ width: size }}>
      <Artwork album={a} size={size} className="transition-[scale,filter] duration-spring-snappy ease-spring-snappy group-hover:brightness-95 group-active:scale-[.97]" />
      <div className="mt-1.5 truncate text-detail leading-tight font-medium">{a.title}</div>
      <div className="truncate text-footnote text-muted-foreground">{caption ?? a.artist}</div>
    </button>
  );
}

function PillButtons({ onPlay, onShuffle }: { onPlay: () => void; onShuffle: () => void }) {
  const pill = 'bl-btn flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[11px] border-0 bg-secondary [font-family:inherit] text-callout font-semibold text-primary transition-[scale,background-color] duration-spring-snappy ease-spring-snappy hover:bg-secondary-strong active:scale-[.97]';
  return (
    <div className="flex w-full max-w-[420px] gap-3">
      <button type="button" className={pill} onClick={onPlay}><Icon name="play" size={18} />Play</button>
      <button type="button" className={pill} onClick={onShuffle}><Icon name="shuffle" size={19} weight="semibold" />Shuffle</button>
    </div>
  );
}

/** A song row; the playing one shows the equalizer instead of its number (or over its artwork). */
function SongRow({ s, i, songs, ctx, art, number }: { s: Song; i: number; songs: Song[]; ctx: Ctx; art?: boolean; number?: number }) {
  const current = ctx.player.current.key === s.key;
  return (
    <button type="button" onClick={() => ctx.player.playFrom(songs, i)} aria-current={current || undefined}
      className="bl-btn group flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-0 pr-4 pl-4 text-left [font-family:inherit] text-foreground hover:bg-secondary active:bg-accent">
      {art ? (
        <span className="relative shrink-0">
          <Artwork album={s.album} size={44} rounded={5} />
          {current ? <span className="absolute inset-0 grid place-items-center rounded-[5px] bg-black/35 text-white"><NowPlayingBars playing={ctx.player.playing} /></span> : null}
        </span>
      ) : (
        <span className="grid w-6 shrink-0 place-items-center text-subhead tabular-nums text-muted-foreground">
          {current ? <NowPlayingBars playing={ctx.player.playing} className="text-primary" /> : number}
        </span>
      )}
      <span className={cn('flex min-w-0 flex-1 items-center gap-2 py-3 shadow-hairline-b', art && 'py-2')}>
        <span className="min-w-0 flex-1">
          <span className={cn('flex items-center gap-1.5 truncate text-callout', current && 'text-primary')}>
            <span className="truncate">{s.track.title}</span>
            {s.track.explicit ? <Icon name="e-square-fill" size={14} aria-label="Explicit" className="text-muted-foreground" /> : null}
          </span>
          {art ? <span className="block truncate text-footnote text-muted-foreground">{s.album.artist}</span> : null}
        </span>
        <span className="text-footnote tabular-nums text-muted-foreground">{fmt(s.track.dur)}</span>
        <Icon name="ellipsis" size={18} className="text-muted-foreground opacity-70" />
      </span>
    </button>
  );
}

function SongList({ songs, ctx, art }: { songs: Song[]; ctx: Ctx; art?: boolean }) {
  return <div className="pt-1">{songs.map((s, i) => <SongRow key={s.key + i} s={s} i={i} songs={songs} ctx={ctx} art={art} number={s.index + 1} />)}</div>;
}

/* ── Listen Now / Browse / Radio / Search ── */

function ListenNow({ ctx }: { ctx: Ctx }) {
  const picks = [ALBUM['velvet-static'], ALBUM['soft-machinery'], ALBUM['neon-tidewater']];
  return (
    <div className="pb-4">
      <Shelf title="Top Picks for You">
        {picks.map((a, i) => (
          <button key={a.id} type="button" onClick={() => ctx.open({ kind: 'album', id: a.id })}
            className="bl-btn shrink-0 snap-start cursor-pointer border-0 bg-transparent p-0 text-left [font-family:inherit]">
            <div className="mb-1.5 text-[12.5px] text-muted-foreground">{['Made for You', 'New Release', 'Because You Listened to Juno Vale'][i]}</div>
            <div className="relative w-[250px] overflow-hidden rounded-panel shadow-[0_4px_16px_black] shadow-black/12"
              style={{ background: `linear-gradient(180deg, ${a.colors[0]}, ${a.colors[1]})` }}>
              <Artwork album={a} size={250} rounded={0} className="shadow-none" />
              <div className="px-3.5 pt-2.5 pb-3.5 text-white">
                <div className="truncate text-callout font-semibold">{a.title}</div>
                <div className="truncate text-footnote text-white/70">{a.artist} · {a.year}</div>
              </div>
            </div>
          </button>
        ))}
      </Shelf>
      <Shelf title="Recently Played" onMore={() => ctx.open({ kind: 'recent' })}>
        {['neon-tidewater', 'paper-satellites', 'copperline', 'glasshouse', 'kites-kowloon', 'field-notes'].map((id) => <AlbumTile key={id} album={ALBUM[id]} ctx={ctx} />)}
      </Shelf>
      <Shelf title="Made for You">
        {PLAYLISTS.map((p) => (
          <button key={p.id} type="button" onClick={() => ctx.open({ kind: 'playlist', id: p.id })}
            className="bl-btn w-[164px] shrink-0 snap-start cursor-pointer border-0 bg-transparent p-0 text-left [font-family:inherit] text-foreground">
            <PlaylistArt playlist={p} size={164} />
            <div className="mt-1.5 truncate text-detail font-medium">{p.title}</div>
            <div className="truncate text-footnote text-muted-foreground">{p.description}</div>
          </button>
        ))}
      </Shelf>
      <Shelf title="New Releases">
        {ALBUMS.filter((a) => a.year === 2026).map((a) => <AlbumTile key={a.id} album={a} ctx={ctx} />)}
      </Shelf>
    </div>
  );
}

function Browse({ ctx }: { ctx: Ctx }) {
  const top = ALL_SONGS.filter((_, i) => i % 5 === 0).slice(0, 12);
  return (
    <div className="pb-4">
      <div className="bl-scroll flex snap-x snap-mandatory scroll-px-4 gap-3.5 overflow-x-auto px-4 pt-2 [scrollbar-width:none]">
        {[ALBUM['midnight-arcade'], ALBUM['kites-kowloon'], ALBUM['salt-ember']].map((a, i) => (
          <button key={a.id} type="button" onClick={() => ctx.open({ kind: 'album', id: a.id })}
            className="bl-btn w-[min(520px,86%)] shrink-0 snap-start cursor-pointer border-0 bg-transparent p-0 text-left [font-family:inherit] text-foreground">
            <div className="text-[11.5px] font-semibold tracking-[.4px] text-muted-foreground uppercase">{['New Album', 'Exclusive', 'Updated Playlist'][i]}</div>
            <div className="truncate text-[21px] font-semibold tracking-[-.2px]">{a.title}</div>
            <div className="mb-2 truncate text-callout text-muted-foreground">{a.artist}</div>
            <div className="relative aspect-[16/9] overflow-hidden rounded-panel" style={{ background: a.colors[0] }}>
              <Artwork album={a} rounded={0} className="absolute top-1/2 right-0 h-[180%] w-auto -translate-y-1/2 shadow-none" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${a.colors[0]} 30%, transparent 75%)` }} />
              <div className="absolute inset-0 bg-linear-to-t/srgb from-black/50 to-transparent to-50%" />
              <div className="absolute bottom-4 left-4 max-w-[55%] text-detail leading-snug font-medium text-white/90">
                {['A neon-lit, eight-bit love letter to late nights.', 'Harbour-front electronica, recorded on rooftops.', 'Sea spray, bonfires, and big choruses.'][i]}
              </div>
            </div>
          </button>
        ))}
      </div>
      <Shelf title="New Music">{ALBUMS.slice(4).map((a) => <AlbumTile key={a.id} album={a} ctx={ctx} />)}</Shelf>
      <section aria-label="Top Songs" className="pt-5">
        <div className="px-4 pb-2 text-[21px] font-bold tracking-[-.3px]">Top Songs</div>
        <div className="grid grid-cols-1 gap-x-6 px-0 @xl:grid-cols-2 @4xl:grid-cols-3">
          {top.map((s, i) => (
            <button key={s.key} type="button" onClick={() => ctx.player.playFrom(top, i)}
              className="bl-btn flex cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-1.5 text-left [font-family:inherit] text-foreground hover:bg-secondary">
              <Artwork album={s.album} size={48} rounded={5} />
              <span className="w-5 text-callout font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 py-1 shadow-hairline-b">
                <span className="block truncate text-subhead">{s.track.title}</span>
                <span className="block truncate pb-1.5 text-footnote text-muted-foreground">{s.album.artist}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Radio({ ctx }: { ctx: Ctx }) {
  const live = STATIONS[0];
  const a = ALBUM[live.album];
  return (
    <div className="pb-4">
      <div className="px-4 pt-2">
        <div className="text-[11.5px] font-semibold tracking-[.4px] text-primary uppercase">Live · 9:00 PM</div>
        <div className="text-[21px] font-semibold">{live.title}</div>
        <div className="mb-2 text-callout text-muted-foreground">Tonight: Harbor Lights take over the booth</div>
        <button type="button" onClick={() => ctx.player.playFrom(albumSongs(a), 0)}
          className="bl-btn relative block aspect-[2/1] w-full max-w-[760px] cursor-pointer overflow-hidden rounded-card border-0 p-0"
          style={{ background: `linear-gradient(120deg, ${a.colors[0]}, ${a.colors[1]})` }}>
          <Artwork album={a} rounded={10} className="absolute top-1/2 right-[6%] h-[72%] w-auto -translate-y-1/2 shadow-[0_12px_40px_black] shadow-black/35" />
          <span className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-subhead font-semibold text-black">
            <Icon name="play" size={15} /> Listen Now
          </span>
          <span className="absolute top-5 left-5 text-left text-[30px] leading-none font-black tracking-[-.5px] text-white">TIDEWATER<br />RADIO</span>
        </button>
      </div>
      <Shelf title="Stations for You">
        {STATIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => ctx.player.playFrom(albumSongs(ALBUM[s.album]), 0)}
            className="bl-btn w-[164px] shrink-0 snap-start cursor-pointer border-0 bg-transparent p-0 text-left [font-family:inherit] text-foreground">
            <span className="relative block">
              <Artwork album={ALBUM[s.album]} size={164} />
              <Icon name="radiowaves" size={22} className="absolute top-2 right-2 text-white drop-shadow-[0_1px_2px_black] drop-shadow-black/40" />
            </span>
            <div className="mt-1.5 truncate text-detail font-medium">{s.title}</div>
            <div className="truncate text-footnote text-muted-foreground">{s.subtitle}</div>
          </button>
        ))}
      </Shelf>
    </div>
  );
}

const CATEGORIES: [string, string][] = [
  ['Electronic', '#5E5CE6'], ['Pop', '#FF375F'], ['Americana', '#C8702A'], ['Ambient', '#30B0C7'], ['Jazz', '#0F766E'],
  ['R&B/Soul', '#AF52DE'], ['Folk', '#8E7B5B'], ['Alternative', '#B33F40'], ['Synthwave', '#6A00F4'], ['Chill', '#34C759'],
];

function Search({ ctx }: { ctx: Ctx }) {
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const albums = s ? ALBUMS.filter((a) => (a.title + ' ' + a.artist).toLowerCase().includes(s)) : [];
  const songs = s ? ALL_SONGS.filter((x) => x.track.title.toLowerCase().includes(s)).slice(0, 8) : [];
  const artists = s ? ARTISTS.filter((a) => a.toLowerCase().includes(s)) : [];
  return (
    <div className="pb-4">
      <div className="px-4 pt-1 pb-3"><SearchField value={q} onChange={setQ} placeholder="Artists, Songs, Lyrics, and More" /></div>
      {!s ? (
        <>
          <div className="px-4 pb-2 text-[21px] font-bold">Browse Categories</div>
          <div className="grid grid-cols-2 gap-3 px-4 @lg:grid-cols-3 @3xl:grid-cols-4">
            {CATEGORIES.map(([name, color], i) => {
              const a = ALBUMS.find((x) => x.genre === name) ?? ALBUMS[i];
              return (
                <button key={name} type="button" onClick={() => setQ(name === 'Chill' ? 'Low' : a.artist)}
                  className="bl-btn relative aspect-[1.55] cursor-pointer overflow-hidden rounded-[11px] border-0 p-0 text-left [font-family:inherit]"
                  style={{ background: color }}>
                  <Artwork album={a} size="46%" rounded={4} className="absolute right-[-6%] bottom-[-6%] rotate-[18deg] shadow-[0_4px_12px_black] shadow-black/25" />
                  <span className="absolute bottom-2.5 left-3 text-callout font-bold text-white">{name}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {artists.map((name) => (
            <button key={name} type="button" onClick={() => ctx.open({ kind: 'artist', name })}
              className="bl-btn flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2 text-left [font-family:inherit] text-foreground hover:bg-secondary">
              <ArtistArt artist={name} album={ALBUMS.find((a) => a.artist === name)!} size={48} />
              <span className="flex-1"><span className="block text-callout">{name}</span><span className="block text-footnote text-muted-foreground">Artist</span></span>
            </button>
          ))}
          {albums.length ? <Shelf title="Albums">{albums.map((a) => <AlbumTile key={a.id} album={a} ctx={ctx} size={140} />)}</Shelf> : null}
          {songs.length ? <><div className="px-4 pt-5 pb-1 text-[21px] font-bold">Songs</div><SongList songs={songs} ctx={ctx} art /></> : null}
          {!artists.length && !albums.length && !songs.length ? <div className="py-16 text-center text-muted-foreground">No results for “{q}”</div> : null}
        </>
      )}
    </div>
  );
}

/* ── Library ── */

type Sym = { name?: IconName; shapes?: readonly IconShape[] };
const LIBRARY_LINKS: [Page, Sym][] = [
  [{ kind: 'artists' }, { name: 'mic' }], [{ kind: 'albums' }, { shapes: ALBUM_ICON }], [{ kind: 'songs' }, { name: 'music-notes' }],
  ...PLAYLISTS.slice(0, 2).map((p): [Page, Sym] => [{ kind: 'playlist', id: p.id }, { name: 'music-note-list' }]),
];

function LibraryHome({ ctx }: { ctx: Ctx }) {
  return (
    <div className="pb-4">
      <div className="pl-4">
        {LIBRARY_LINKS.map(([page, icon]) => (
          <button key={pageKey(page)} type="button" onClick={() => ctx.open(page)}
            className="bl-btn flex w-full cursor-pointer items-center gap-3.5 border-0 bg-transparent py-0 pr-4 pl-0 text-left [font-family:inherit] text-foreground">
            <Icon {...icon} size={24} className="text-primary" />
            <span className="flex flex-1 items-center py-3 text-title shadow-hairline-b">
              <span className="flex-1">{pageTitle(page)}</span>
              <Icon name="chevron-right" size={16} weight="bold" className="text-tertiary-foreground" />
            </span>
          </button>
        ))}
      </div>
      <div className="px-4 pt-6 pb-2.5 text-[21px] font-bold tracking-[-.3px]">Recently Added</div>
      <AlbumGrid albums={[...ALBUMS].sort((a, b) => a.added - b.added).slice(0, 6)} ctx={ctx} />
    </div>
  );
}

function AlbumGrid({ albums, ctx }: { albums: Album[]; ctx: Ctx }) {
  return (
    <div className="grid gap-x-4 gap-y-5 px-4 pt-1 pb-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${ctx.wide ? 170 : 150}px, 1fr))` }}>
      {albums.map((a) => (
        <button key={a.id} type="button" onClick={() => ctx.open({ kind: 'album', id: a.id })}
          className="bl-btn group min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left [font-family:inherit] text-foreground">
          <Artwork album={a} className="aspect-square w-full transition-[scale] duration-spring-snappy ease-spring-snappy group-active:scale-[.97]" />
          <div className="mt-1.5 truncate text-detail font-medium">{a.title}</div>
          <div className="truncate text-footnote text-muted-foreground">{a.artist}</div>
        </button>
      ))}
    </div>
  );
}

function ArtistList({ ctx }: { ctx: Ctx }) {
  return (
    <div className="pt-1 pl-4">
      {ARTISTS.map((name) => (
        <button key={name} type="button" onClick={() => ctx.open({ kind: 'artist', name })}
          className="bl-btn flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-0 pr-4 pl-0 text-left [font-family:inherit] text-foreground">
          <ArtistArt artist={name} album={ALBUMS.find((a) => a.artist === name)!} size={44} />
          <span className="flex flex-1 items-center py-3.5 text-body shadow-hairline-b">
            <span className="flex-1">{name}</span>
            <Icon name="chevron-right" size={15} weight="bold" className="text-tertiary-foreground" />
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── Detail pages ── */

/** Music's red, for artwork with no legible color (fixed). */
const FALLBACK_TINT = { light: '#FA243C', dark: '#FF375F' } as const;

/** The page tints from its artwork: the album's most legible color becomes the tint for its buttons and links. */
function tintFor(a: Album, dark: boolean) {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ok = a.colors.filter((c) => (dark ? lum(c) > 0.16 && lum(c) < 0.75 : lum(c) > 0.04 && lum(c) < 0.3));
  return ok.sort((x, y) => Math.abs(lum(x) - (dark ? 0.35 : 0.12)) - Math.abs(lum(y) - (dark ? 0.35 : 0.12)))[0] ?? FALLBACK_TINT[dark ? 'dark' : 'light'];
}

function AlbumPage({ album: a, ctx }: { album: Album; ctx: Ctx }) {
  const songs = albumSongs(a);
  const more = ALBUMS.filter((x) => x.artist === a.artist && x.id !== a.id);
  return (
    <div className="pb-6" style={{ '--primary': tintFor(a, ctx.dark) } as CSSProperties}>
      <div className={cn('flex gap-6 px-4 pt-2 pb-5', ctx.wide ? 'items-end px-6' : 'flex-col items-center text-center')}>
        <Artwork album={a} size={ctx.wide ? 250 : 260} rounded={10} className="shadow-[0_10px_30px_black] shadow-black/18" />
        <div className={cn('flex min-w-0 flex-col gap-1', ctx.wide ? 'items-start pb-1' : 'items-center')}>
          <h2 className="m-0 text-[24px] leading-tight font-bold tracking-[-.3px]">{a.title}</h2>
          <button type="button" onClick={() => ctx.open({ kind: 'artist', name: a.artist })}
            className="bl-btn cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] text-title text-primary">{a.artist}</button>
          <div className="text-[12.5px] font-semibold tracking-[.3px] text-muted-foreground uppercase">{a.genre} · {a.year} · Lossless</div>
          <div className="mt-3.5 w-full"><PillButtons onPlay={() => ctx.player.playFrom(songs, 0)} onShuffle={() => ctx.player.playFrom(songs, (songs.length * 7) % songs.length)} /></div>
        </div>
      </div>
      <SongList songs={songs} ctx={ctx} />
      <div className="px-4 pt-3 text-footnote leading-relaxed text-muted-foreground">
        {a.tracks.length} songs, {minutes(songs)} minutes<br />℗ {a.year} {a.label}
      </div>
      {more.length ? <Shelf title={`More by ${a.artist}`}>{more.map((x) => <AlbumTile key={x.id} album={x} ctx={ctx} caption={String(x.year)} />)}</Shelf> : null}
    </div>
  );
}

function ArtistPage({ name, ctx }: { name: string; ctx: Ctx }) {
  const albums = ALBUMS.filter((a) => a.artist === name);
  const top = albums.flatMap(albumSongs).slice(0, 5);
  const a = albums[0];
  return (
    <div className="pb-6">
      <div className="relative mx-4 mt-1 flex aspect-[2.2] max-h-[300px] w-[calc(100%-2rem)] items-end overflow-hidden rounded-card p-5"
        style={{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})` }}>
        <Artwork album={a} rounded={0} className="absolute inset-0 size-full scale-125 opacity-60 blur-[18px]" />
        <div className="relative flex items-center gap-4">
          <ArtistArt artist={name} album={a} size={72} />
          <div className="text-[30px] font-extrabold tracking-[-.4px] text-white text-shadow-[0_2px_12px_black] text-shadow-black/30">{name}</div>
        </div>
      </div>
      <div className="px-4 pt-5 pb-1 text-[21px] font-bold">Top Songs</div>
      <SongList songs={top} ctx={ctx} art />
      <Shelf title="Albums">{albums.map((x) => <AlbumTile key={x.id} album={x} ctx={ctx} caption={String(x.year)} />)}</Shelf>
    </div>
  );
}

function PlaylistPage({ id, ctx }: { id: string; ctx: Ctx }) {
  const p = PLAYLISTS.find((x) => x.id === id)!;
  const songs = playlistSongs(p);
  return (
    <div className="pb-6">
      <div className={cn('flex gap-6 px-4 pt-2 pb-5', ctx.wide ? 'items-end px-6' : 'flex-col items-center text-center')}>
        <PlaylistArt playlist={p} size={ctx.wide ? 250 : 260} rounded={10} />
        <div className={cn('flex min-w-0 flex-col gap-1', ctx.wide ? 'items-start' : 'items-center')}>
          <h2 className="m-0 text-[24px] leading-tight font-bold">{p.title}</h2>
          <div className="text-[18px] text-primary">{p.curator}</div>
          <div className="text-detail text-muted-foreground">{p.description}</div>
          <div className="mt-3.5 w-full"><PillButtons onPlay={() => ctx.player.playFrom(songs, 0)} onShuffle={() => ctx.player.playFrom(songs, 2)} /></div>
        </div>
      </div>
      <SongList songs={songs} ctx={ctx} art />
      <div className="px-4 pt-3 text-footnote text-muted-foreground">{songs.length} songs, {minutes(songs)} minutes</div>
    </div>
  );
}

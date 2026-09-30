/* Generated album artwork: each album's two-stop gradient under one of a handful of patterns, with the title
   set small in a corner the way real covers do. Pure SVG, so it's crisp at 40px and at full screen. */
import { useId, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { ALBUM, type Album, type Playlist } from './data';

function PatternArt({ album: a, uid }: { album: Album; uid: string }) {
  const [c1, c2, accent, ink] = a.colors;
  switch (a.pattern) {
    case 'sun':
      return (
        <>
          <circle cx="50" cy="56" r="26" fill={`url(#${uid}s)`} />
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="0" y={62 + i * 6.4} width="100" height={1.2 + i * 0.5} fill={c1} opacity=".9" />)}
          <rect x="0" y="82" width="100" height="18" fill={c1} opacity=".35" />
        </>
      );
    case 'rings':
      return <>{[34, 27, 20, 13, 6].map((r, i) => <circle key={r} cx="62" cy="40" r={r} fill="none" stroke={i % 2 ? ink : accent} strokeWidth="2.6" opacity={0.35 + i * 0.13} />)}</>;
    case 'stripes':
      return (
        <g transform="rotate(-18 50 50)">
          {Array.from({ length: 9 }, (_, i) => <rect key={i} x="-20" y={i * 14 - 12} width="140" height="6" fill={i % 3 === 0 ? ink : accent} opacity={i % 3 === 0 ? 0.55 : 0.8} />)}
        </g>
      );
    case 'grid':
      return (
        <>
          <circle cx="50" cy="44" r="20" fill={`url(#${uid}s)`} />
          <rect x="0" y="52" width="100" height="48" fill={c1} />
          {Array.from({ length: 8 }, (_, i) => <line key={'h' + i} x1="0" x2="100" y1={54 + i * i * 0.9} y2={54 + i * i * 0.9} stroke={ink} strokeWidth=".7" opacity=".8" />)}
          {Array.from({ length: 13 }, (_, i) => <line key={'v' + i} x1={50 + (i - 6) * 4} y1="52" x2={50 + (i - 6) * 22} y2="100" stroke={ink} strokeWidth=".7" opacity=".8" />)}
        </>
      );
    case 'blobs':
      return (
        <>
          <path d="M18 30c10-16 34-14 40 2s-6 26-20 26-30-12-20-28z" fill={accent} opacity=".85" />
          <path d="M52 62c12-10 34-6 36 10s-16 22-28 18-18-18-8-28z" fill={ink} opacity=".8" />
          <circle cx="78" cy="24" r="8" fill={c2} stroke={ink} strokeWidth="1.4" />
        </>
      );
    case 'triangles':
      return (
        <>
          {[[10, 80, 40, 20, 70, 80], [45, 90, 70, 40, 95, 90], [60, 30, 78, 6, 96, 30], [0, 40, 14, 18, 28, 40]].map((p, i) => (
            <polygon key={i} points={p.join(' ')} fill={[accent, ink, c2, accent][i]} opacity={[0.9, 0.85, 0.9, 0.6][i]} />
          ))}
          <line x1="40" y1="20" x2="30" y2="95" stroke={ink} strokeWidth=".6" />
          <line x1="78" y1="6" x2="84" y2="95" stroke={ink} strokeWidth=".6" />
        </>
      );
    case 'waves':
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M0 ${50 + i * 10} Q 25 ${40 + i * 10} 50 ${50 + i * 10} T 100 ${50 + i * 10} V100 H0z`} fill={i % 2 ? ink : accent} opacity={0.18 + i * 0.12} />
          ))}
          <circle cx="72" cy="28" r="9" fill={ink} opacity=".9" />
        </>
      );
    case 'dots':
      return (
        <>
          {Array.from({ length: 36 }, (_, i) => {
            const x = (i % 6) * 16 + 10, y = Math.floor(i / 6) * 16 + 10;
            return <circle key={i} cx={x} cy={y} r={2 + ((i * 7) % 5)} fill={i % 5 === 0 ? ink : accent} opacity={i % 5 === 0 ? 0.9 : 0.75} />;
          })}
        </>
      );
    case 'arch':
      return (
        <>
          <path d="M22 100V52a28 28 0 0 1 56 0v48z" fill={accent} opacity=".9" />
          <path d="M34 100V56a16 16 0 0 1 32 0v44z" fill={c1} opacity=".9" />
          <circle cx="50" cy="60" r="6" fill={ink} />
        </>
      );
    case 'bars':
      return <>{Array.from({ length: 10 }, (_, i) => <rect key={i} x={8 + i * 8.6} y={100 - (18 + ((i * 37) % 60))} width="5.6" height={18 + ((i * 37) % 60)} rx="1.2" fill={i % 3 ? accent : ink} />)}</>;
  }
}

export function Artwork({ album: a, size, className, style, rounded = 8 }: {
  album: Album; size?: number | string; className?: string; style?: CSSProperties; rounded?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const [c1, c2, accent, ink] = a.colors;
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={`${a.title} artwork`} preserveAspectRatio="xMidYMid slice"
      className={cn('block shrink-0 overflow-hidden shadow-[0_0_0_.5px_black] shadow-black/10', className)}
      style={{ width: size, height: size, borderRadius: rounded, ...style }}>
      <defs>
        <linearGradient id={uid + 'g'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
        <linearGradient id={uid + 's'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ink} /><stop offset="1" stopColor={accent} /></linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${uid}g)`} />
      <PatternArt album={a} uid={uid} />
      <text x="7" y="12" fontSize="5.4" fontWeight="700" letterSpacing=".6" fill={ink} opacity=".92" className="font-ios uppercase">{a.artist}</text>
      <text x="7" y="18.5" fontSize="4.6" letterSpacing=".3" fill={ink} opacity=".75" className="font-ios">{a.title}</text>
    </svg>
  );
}

/** Playlist cover: Apple's 2×2 mosaic of the first four albums in it, with the title over a scrim. */
export function PlaylistArt({ playlist: p, size, className, rounded = 8 }: { playlist: Playlist; size?: number | string; className?: string; rounded?: number }) {
  const ids = [...new Set(p.songs.map(([id]) => id))].slice(0, 4);
  while (ids.length < 4) ids.push(ids[0]);
  return (
    <span className={cn('relative grid shrink-0 grid-cols-2 overflow-hidden shadow-[0_0_0_.5px_black] shadow-black/10', className)}
      style={{ width: size, height: size, borderRadius: rounded }} role="img" aria-label={`${p.title} artwork`}>
      {ids.map((id, i) => <Artwork key={i} album={ALBUM[id]} rounded={0} className="size-full shadow-none" />)}
    </span>
  );
}

/** Round artist portrait: a crop of their latest album with their initials. */
export function ArtistArt({ artist, album, size = 44 }: { artist: string; album: Album; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-full" style={{ width: size, height: size, background: album.colors[1] }}>
      <Artwork album={album} rounded={0} className="absolute inset-0 size-full scale-[1.6] blur-[1.5px]" />
      <span className="relative font-bold text-white text-shadow-[0_1px_3px_black] text-shadow-black/40" style={{ fontSize: size * 0.34 }}>
        {artist.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('')}
      </span>
    </span>
  );
}

/* Playback, simulated: a queue of songs, the current index, a position that advances while playing, volume,
   shuffle and repeat. Nothing makes sound — the clock is the song. */
import { useEffect, useState } from 'react';
import { albumSongs, ALBUM, type Song } from './data';

export type Repeat = 'off' | 'all' | 'one';

export function usePlayer(initial?: { queue: Song[]; index: number; position?: number; playing?: boolean }) {
  const [queue, setQueue] = useState<Song[]>(initial?.queue ?? albumSongs(ALBUM['neon-tidewater']));
  const [index, setIndex] = useState(initial?.index ?? 1);
  const [position, setPosition] = useState(initial?.position ?? 74);
  const [playing, setPlaying] = useState(initial?.playing ?? false);
  const [volume, setVolume] = useState(70);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>('off');
  const current = queue[index];

  const go = (i: number) => {
    const n = queue.length;
    const next = repeat === 'off' ? Math.min(Math.max(i, 0), n - 1) : (i + n) % n;
    if (i >= n && repeat === 'off') { setPlaying(false); setPosition(0); return; }
    setIndex(next);
    setPosition(0);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPosition((p) => Math.min(p + 0.25, current.track.dur)), 250);
    return () => clearInterval(id);
  }, [playing, current]);

  // At the end of a song: play it again (repeat one) or move on.
  useEffect(() => {
    if (!playing || position < current.track.dur) return;
    if (repeat === 'one') setPosition(0);
    else go(index + 1);
  }, [position]);

  return {
    queue, index, current, position, playing, volume, shuffle, repeat,
    upNext: queue.slice(index + 1),
    toggle: () => setPlaying((p) => !p),
    next: () => go(index + 1),
    // Like every player: back restarts the song unless it has barely begun.
    prev: () => { if (position > 3) setPosition(0); else go(index - 1); },
    seek: (s: number) => setPosition(s),
    setVolume,
    playFrom: (songs: Song[], i: number) => {
      setQueue(songs); setIndex(i); setPosition(0); setPlaying(true);
    },
    jump: (i: number) => { setIndex(i); setPosition(0); setPlaying(true); },
    toggleShuffle: () => {
      // Turning shuffle on reshuffles what's up next; the current song keeps playing.
      if (!shuffle) {
        const rest = queue.slice(index + 1);
        for (let i = rest.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }
        setQueue([...queue.slice(0, index + 1), ...rest]);
      }
      setShuffle(!shuffle);
    },
    cycleRepeat: () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
  };
}
export type Player = ReturnType<typeof usePlayer>;

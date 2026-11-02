/* Strudel Studio — write a Strudel song and play it on hardware generated from its code. The left pane holds the
   code (and its syntax tree); the right is the rack on a masonry grid: drag modules by their titles, resize them
   from their corners, and every knob, fader, pad and step key rewrites the code while it plays. Resting on a song in
   the switcher previews it in a hover card (its tempo and the tracks it would put in the rack, as currently edited);
   the syntax tree previews its tracks and patterns the same way. */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardHeader, HoverCardTrigger } from '@/components/ui/hover-card';
import { Segmented } from '@/components/ui/segmented';
import { StrudelRack } from '@/components/ui/strudel-rack';
import { playStrudel, stopStrudel, updateStrudel } from '@/components/ui/strudel-player';
import { parseStrudel, StrudelSyntaxError, type StrudelSong } from '@/components/ui/strudel-syntax';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs';
import { Icon } from '@/lib/icon';
import { BLProvider } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { SONGS, type StudioSong } from './songs';
import { SyntaxTree } from './syntax-tree';

const OWNER = 'strudel-studio';

export interface StrudelStudioProps {
  /** The starter song to open (an id from songs.ts). */
  initialSong?: string;
}

/** A song's tempo and tracks, read from its code as edited so far. */
function SongCard({ song, code }: { song: StudioSong; code: string }) {
  const parsed = useMemo(() => { try { return parseStrudel(code); } catch { return null; } }, [code]);
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader
        media={<span className="grid size-9 place-items-center rounded-lg bg-success/15 text-success"><Icon name="music-note" size={19} /></span>}
        title={song.title}
        subtitle={parsed ? [parsed.tempo ? `${Math.round(parsed.tempo.cps * 240)} bpm` : null, `${parsed.tracks.length} tracks`].filter(Boolean).join(' · ') : 'Doesn’t parse yet'} />
      {parsed ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {parsed.tracks.map((t) => (
            <li key={t.index} className="flex items-baseline gap-2 text-footnote">
              <span className={cn('min-w-0 flex-1 truncate', t.muted && 'text-muted-foreground line-through')}>{t.label ?? `Track ${t.index + 1}`}</span>
              <span className="shrink-0 font-mono text-caption2 text-muted-foreground">{t.sound ?? t.kind}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function StrudelStudio({ initialSong = 'night-drive' }: StrudelStudioProps) {
  const [songId, setSongId] = useState(initialSong);
  const [codes, setCodes] = useState<Record<string, string>>(() => Object.fromEntries(SONGS.map((s) => [s.id, s.code])));
  const code = codes[songId] ?? '';
  const setCode = (next: string) => setCodes((c) => ({ ...c, [songId]: next }));
  const [playable, setPlayable] = useState(code);
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo((): { song: StrudelSong; error?: never } | { song?: never; error: string } => {
    try {
      return { song: parseStrudel(code) };
    } catch (err) {
      return { error: err instanceof StrudelSyntaxError ? `${err.message} (at ${err.offset})` : String(err) };
    }
  }, [code]);

  // Live: while playing, every edit (code, knob, mute) swaps the pattern in without stopping.
  useEffect(() => {
    if (status !== 'playing') return;
    const t = setTimeout(() => {
      updateStrudel(OWNER, playable).then(() => setError(null), (err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    }, 150);
    return () => clearTimeout(t);
  }, [playable, status]);
  useEffect(() => () => void stopStrudel(OWNER), []);

  const toggle = async () => {
    if (status !== 'idle') {
      await stopStrudel(OWNER);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      await playStrudel(OWNER, playable);
      setStatus('playing');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <BLProvider dark className="bg-background">
      <div className="flex h-full min-h-[640px] w-full flex-col text-foreground">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <Button onPress={toggle} aria-label={status === 'idle' ? 'Play' : 'Stop'} className="min-w-24">
            <Icon name={status === 'idle' ? 'play' : status === 'loading' ? 'arrow-clockwise' : 'stop'} size={16} />
            {status === 'idle' ? 'Play' : status === 'loading' ? 'Loading' : 'Stop'}
          </Button>
          <div className="font-semibold tracking-tight">Strudel Studio</div>
          <Segmented
            aria-label="Song"
            className="ms-auto"
            options={SONGS.map((s) => ({
              id: s.id,
              label: (
                <HoverCardTrigger>
                  <span>{s.title}</span>
                  <HoverCard placement="bottom end" className="w-64"><SongCard song={s} code={codes[s.id] ?? ''} /></HoverCard>
                </HoverCardTrigger>
              ),
            }))}
            value={songId}
            onChange={(id) => {
              setSongId(id);
              setPlayable(codes[id] ?? '');
            }}
          />
        </header>
        {error ? <p role="alert" className="px-4 pt-2 text-sm text-destructive">{error}</p> : null}
        <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
          <Tabs className="min-h-0">
            <TabList aria-label="Source">
              <Tab id="code">Code</Tab>
              <Tab id="tree">Syntax tree</Tab>
            </TabList>
            <TabPanel id="code" className="min-h-0">
              <textarea
                aria-label="Strudel code"
                spellCheck={false}
                wrap="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-full min-h-[320px] w-full resize-none rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs leading-relaxed text-success outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </TabPanel>
            <TabPanel id="tree" className="max-h-[560px] overflow-auto rounded-lg border border-white/10 p-2">
              {parsed.song ? <SyntaxTree song={parsed.song} /> : <p className="text-sm text-destructive">{parsed.error}</p>}
            </TabPanel>
          </Tabs>
          <div className="min-w-0 overflow-auto">
            <StrudelRack key={songId} code={code} onChange={setCode} onPlayableChange={setPlayable} layout="grid" persistKey={`strudel-studio:${songId}`} />
          </div>
        </div>
      </div>
    </BLProvider>
  );
}

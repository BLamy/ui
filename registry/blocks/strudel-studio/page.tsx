/* Strudel Studio — write a Strudel song and play it on hardware generated from its code. The left pane holds the
   code (and its syntax tree); the right is the rack on a masonry grid: drag modules by their titles, resize them
   from their corners, and every knob, fader, pad and step key rewrites the code while it plays. */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { StrudelRack } from '@/components/ui/strudel-rack';
import { playStrudel, stopStrudel, updateStrudel } from '@/components/ui/strudel-player';
import { parseStrudel, StrudelSyntaxError, type StrudelSong } from '@/components/ui/strudel-syntax';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs';
import { Icon } from '@/lib/icon';
import { BLProvider } from '@/lib/theme';
import { SONGS } from './songs';
import { SyntaxTree } from './syntax-tree';

const OWNER = 'strudel-studio';

export interface StrudelStudioProps {
  /** The starter song to open (an id from songs.ts). */
  initialSong?: string;
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
            options={SONGS.map((s) => ({ id: s.id, label: s.title }))}
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

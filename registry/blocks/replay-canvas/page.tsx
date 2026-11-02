'use client';
/* Replay Canvas — an app taken apart from its rrweb recordings, on a canvas. Every recording is read for the pages it
   visits, the layers that open over them (dialogs, menus, sheets, popovers, toasts) and the states they go through,
   and folded into one map: each frame is the recording itself paused at that moment, a layer cropped to just the
   layer, beside the page it opened over; segues run from where the click landed to what it opened, saying what was
   clicked. The more recordings, the fuller the map: what they agree on merges (and is counted), what's new is added.
   Drop rrweb .json files (an event array, `{ events }`, or a list of `{ name, events }`) anywhere on it. Signed in to
   Replay (`replayApiKey`, or REPLAY_API_KEY from the docs page's env), it lists your Replay QA projects and their test
   runs; pressing one loads every journey's recording in it. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useDocstreamEnv } from '@brett_lamy/docstream';
import { getReplayMeta, type ReplayEvent } from '@/components/ui/replay-preview';
import { fitCamera, unionRect, type Camera, type Rect } from '@/lib/canvas-math';
import { useContainerSize } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { BLProvider, useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { analyzeRecordings, type Recording } from './analyze';
import { Board, type Selection } from './board';
import { Inspector } from './inspector';
import { layoutMap, type Crops } from './layout';
import { QaAuthError, createQaClient, type QaProject, type QaTestRun } from './qa';
import { QaPanel, type QaLoad } from './qa-panel';
import { SAMPLE_RECORDINGS } from './recordings';
import { Sidebar, type SourceRecording } from './sidebar';
import { ToolButton } from './toolbar';

export type { Recording } from './analyze';

export interface ReplayCanvasProps {
  /** The rrweb recordings to map (the Tandem sample sessions by default). */
  recordings?: Recording[];
  /** A Replay access token: lists your Replay QA projects and loads their test runs' recordings. Defaults to
   *  REPLAY_API_KEY from the docs page's env (the Replay sign-in). */
  replayApiKey?: string;
  /** The Replay QA API to ask (a staging or PR-preview server's `…/api/v1`); qa.replay.io's by default. */
  replayQaApi?: string;
  /** Light or dark chrome; defaults to the ambient appearance. */
  appearance?: 'light' | 'dark';
  className?: string;
}

/** Reads a dropped or picked file into recordings: an rrweb event array, `{ events }`, or `[{ name, events }]`. */
async function readRecordings(file: File): Promise<Recording[]> {
  const data: unknown = JSON.parse(await file.text());
  const base = file.name.replace(/\.(rrweb\.)?json$/i, '');
  const isEvents = (v: unknown): v is ReplayEvent[] => Array.isArray(v) && v.every((e) => e && typeof e === 'object' && 'type' in e && 'timestamp' in e);
  if (isEvents(data)) return [{ id: `${base}-${crypto.randomUUID().slice(0, 6)}`, name: base, events: data }];
  if (data && typeof data === 'object' && 'events' in data && isEvents((data as { events: unknown }).events)) {
    return [{ id: `${base}-${crypto.randomUUID().slice(0, 6)}`, name: String((data as { name?: unknown }).name ?? base), events: (data as { events: ReplayEvent[] }).events }];
  }
  if (Array.isArray(data)) {
    return data
      .filter((r): r is { name?: string; events: ReplayEvent[] } => !!r && typeof r === 'object' && isEvents((r as { events?: unknown }).events))
      .map((r, i) => ({ id: `${base}-${i}-${crypto.randomUUID().slice(0, 6)}`, name: r.name ?? `${base} ${i + 1}`, events: r.events }));
  }
  return [];
}

/** Journeys loaded at once from a test run. */
const QA_PARALLEL = 4;

/** An rrweb stream plays once it has a Meta followed by a FullSnapshot. */
const playable = (events: ReplayEvent[]) => events.some((e, i) => e.type === 2 && events[i - 1]?.type === 4);

export default function ReplayCanvas({ recordings = SAMPLE_RECORDINGS, replayApiKey, replayQaApi, appearance, className }: ReplayCanvasProps) {
  const ambient = useAppearance();
  const env = useDocstreamEnv();
  const apiKey = replayApiKey ?? env.values.REPLAY_API_KEY;
  const qa = useMemo(() => (apiKey ? createQaClient(apiKey, replayQaApi) : null), [apiKey, replayQaApi]);
  const [qaLoad, setQaLoad] = useState<QaLoad | null>(null);
  const qaLoading = useRef<AbortController | null>(null);
  useEffect(() => () => qaLoading.current?.abort(), []);
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 1280, height: 760 });
  const narrow = size.width < 960;
  const [sources, setSources] = useState<SourceRecording[]>(() => recordings.map((r) => ({ ...r, enabled: true })));
  const [crops, setCrops] = useState<Crops>({});
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 0.1 });
  const [selection, setSelection] = useState<Selection>(null);
  const [shown, setShown] = useState<Record<string, number>>({});
  const [showDismiss, setShowDismiss] = useState(false);
  const [showArrows, setShowArrows] = useState(true);
  const [panes, setPanes] = useState<{ nav: boolean; inspector: boolean } | null>(null);
  const [dropping, setDropping] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const navOpen = panes?.nav ?? !narrow;
  const inspectorOpen = panes?.inspector ?? !narrow;

  const enabled = useMemo(() => sources.filter((s) => s.enabled), [sources]);
  const map = useMemo(() => analyzeRecordings(enabled), [enabled]);
  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s as Recording])), [sources]);
  const viewport = useMemo(() => {
    const meta = enabled[0] ? getReplayMeta(enabled[0].events) : null;
    return { w: meta?.width || 1280, h: meta?.height || 800 };
  }, [enabled]);
  const boxes = useMemo(() => layoutMap(map, viewport, crops), [map, viewport, crops]);

  const onCrop = useCallback((key: string, r: Rect) => {
    setCrops((c) => {
      const o = c[key];
      return o && o.x === r.x && o.y === r.y && o.w === r.w && o.h === r.h ? c : { ...c, [key]: r };
    });
  }, []);

  const fitTo = useCallback((r: Rect | null, pad = 64) => {
    const el = canvas.current?.getBoundingClientRect();
    if (el && el.width > 50) setCamera(fitCamera(r && { ...r, y: r.y - 60, h: r.h + 60 }, { width: el.width, height: el.height }, pad));
  }, []);

  // Everything in view on opening and whenever the recordings change.
  const fitted = useRef<string | null>(null);
  const fitKey = `${enabled.map((s) => s.id).join('|')}`;
  useLayoutEffect(() => {
    if (fitted.current === fitKey || !boxes.length || !canvas.current || canvas.current.getBoundingClientRect().width < 50) return;
    fitted.current = fitKey;
    fitTo(unionRect(boxes));
  });

  const focus = (key: string) => {
    setSelection({ kind: 'frame', key });
    const box = boxes.find((b) => b.key === key);
    if (box) fitTo(box, 48);
  };

  const add = async (files: File[]) => {
    const read = (await Promise.all(files.map((f) => readRecordings(f).catch(() => [])))).flat();
    if (read.length) setSources((s) => [...s, ...read.map((r) => ({ ...r, enabled: true }))]);
  };

  // A test run replaces the recordings with its journeys', added a few at a time as they arrive.
  const openTestRun = (project: QaProject, run: QaTestRun) => {
    if (!qa) return;
    qaLoading.current?.abort();
    const ctl = new AbortController();
    qaLoading.current = ctl;
    setSources([]); setCrops({}); setSelection(null); setShown({});
    setQaLoad({ projectId: project.id, runId: run.id, done: 0, total: run.runs.length, empty: 0, loading: true });
    const update = (f: (l: QaLoad) => QaLoad) => setQaLoad((l) => (l && l.runId === run.id && !ctl.signal.aborted ? f(l) : l));
    const queue = [...run.runs];
    let ready: SourceRecording[] = [];
    const flush = () => {
      if (!ready.length || ctl.signal.aborted) return;
      const batch = ready;
      ready = [];
      setSources((s) => [...s, ...batch]);
    };
    const worker = async () => {
      for (let r = queue.shift(); r && !ctl.signal.aborted; r = queue.shift()) {
        let ok = false;
        try {
          const events = (await qa.recording(project.id, r.id, ctl.signal)).sort((a, b) => a.timestamp - b.timestamp);
          ok = playable(events);
          if (ok) ready.push({ id: `qa-${r.id}`, name: r.journey_name || r.goal || r.id, events, enabled: true });
        } catch (e) {
          if (ctl.signal.aborted) return;
          if (e instanceof QaAuthError) { update((l) => ({ ...l, error: e.message })); ctl.abort(); return; }
        }
        update((l) => ({ ...l, done: l.done + 1, empty: l.empty + (ok ? 0 : 1) }));
      }
    };
    const timer = setInterval(flush, 700);
    void Promise.all(Array.from({ length: QA_PARALLEL }, worker)).finally(() => {
      clearInterval(timer);
      flush();
      setQaLoad((l) => (l && l.runId === run.id ? { ...l, loading: false } : l));
    });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    void add([...e.dataTransfer.files].filter((f) => /json$/i.test(f.name) || f.type.includes('json')));
  };

  const states = boxes.length;
  return (
    <BLProvider dark={(appearance ?? ambient) === 'dark'}>
      <div
        ref={ref}
        data-slot="replay-canvas"
        className={cn('relative flex size-full min-h-0 flex-col overflow-hidden bg-background text-foreground', className)}
        onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDropping(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }}
        onDrop={onDrop}
      >
        <header className="flex h-toolbar shrink-0 items-center gap-1 border-b border-border bg-bar px-2">
          <ToolButton icon="sidebar" label={navOpen ? 'Hide recordings' : 'Show recordings'} active={navOpen} onPress={() => setPanes({ nav: !navOpen, inspector: inspectorOpen })} />
          <div role="heading" aria-level={1} className="ml-1 text-subhead font-semibold">Replay Canvas</div>
          <p className="m-0 ml-2 min-w-0 truncate text-footnote text-muted-foreground">
            {enabled.length} recording{enabled.length === 1 ? '' : 's'} → {map.pages.length} pages · {map.overlays.length} layers · {states} frames · {map.segues.length} segues
          </p>
          <div className="flex-1" />
          <ToolButton icon="arrow-up-right" label={showArrows ? 'Hide arrows (dots stay; select one to see its arrow)' : 'Show arrows'} active={showArrows} onPress={() => setShowArrows((v) => !v)} />
          <ToolButton icon="xmark-circle" label={showDismiss ? 'Hide dismissals' : 'Show dismissals'} active={showDismiss} onPress={() => setShowDismiss((v) => !v)} />
          <ToolButton icon="magnifyingglass" label="Zoom to fit (⌘0)" onPress={() => fitTo(unionRect(boxes))} />
          <ToolButton icon="sidebar" label={inspectorOpen ? 'Hide inspector' : 'Show inspector'} active={inspectorOpen} className="-scale-x-100" onPress={() => setPanes({ nav: navOpen, inspector: !inspectorOpen })} />
        </header>
        <div className="relative flex min-h-0 flex-1">
          {navOpen && (
            <div className={cn('w-64 shrink-0', narrow && 'absolute inset-y-0 left-0 z-10 shadow-xl')}>
              <Sidebar
                recordings={sources}
                map={map}
                onToggle={(id, on) => setSources((s) => s.map((r) => (r.id === id ? { ...r, enabled: on } : r)))}
                onRemove={(id) => setSources((s) => s.filter((r) => r.id !== id))}
                onAdd={(files) => void add(files)}
                selection={selection}
                onSelect={focus}
                qa={qa && <QaPanel client={qa} load={qaLoad} onOpen={openTestRun} />}
              />
            </div>
          )}
          <div ref={canvas} className="relative min-w-0 flex-1">
            <Board
              map={map}
              boxes={boxes}
              recordings={byId}
              viewport={viewport}
              crops={crops}
              onCrop={onCrop}
              camera={camera}
              onCameraChange={setCamera}
              selection={selection}
              onSelect={setSelection}
              showDismiss={showDismiss}
              showArrows={showArrows}
              shown={shown}
            />
            {!enabled.length && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-footnote text-muted-foreground">
                <div><Icon name="download" size={28} sw={1.6} className="mx-auto mb-2" />
                  {qaLoad?.loading ? 'Loading the test run’s recordings…' : qa ? 'Pick a Replay QA test run, or drop rrweb recordings (.json), to map the app they were recorded in.' : 'Drop rrweb recordings (.json) to map the app they were recorded in.'}
                </div>
              </div>
            )}
            {dropping && <div className="pointer-events-none absolute inset-2 rounded-panel border-2 border-dashed border-primary bg-primary/8" />}
          </div>
          {inspectorOpen && (
            <div className={cn('w-80 shrink-0', narrow && 'absolute inset-y-0 right-0 z-10 shadow-xl')}>
              <Inspector map={map} recordings={byId} selection={selection} onSelect={setSelection} shown={shown} onShow={(key, i) => setShown((s) => ({ ...s, [key]: i }))} />
            </div>
          )}
        </div>
      </div>
    </BLProvider>
  );
}

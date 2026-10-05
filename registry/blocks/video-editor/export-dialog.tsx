import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogBody, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FfmpegError, type Ffmpeg, type FfmpegProgress } from '@/lib/ffmpeg';
import { formatBytes } from '@/lib/format-bytes';
import { Icon } from '@/lib/icon';
import { buildRender, type RenderContainer, type RenderMedia, type RenderPlan, type RenderQuality } from '@/lib/video-render';
import { timelineDuration, type Timeline, type TimelineFormat } from '@/lib/video-timeline';
import type { MediaItem, Project } from './store';
import { isTitle, titleData, titlePng } from './titles';

/* Export: pick a container, quality and size; the timeline becomes one FFmpeg command (titles drawn to PNGs first),
   which runs in a worker with live progress and can be cancelled. The result plays right in the sheet, with its size,
   a download, and the exact command FFmpeg ran. */

const CONTAINERS: { id: RenderContainer; label: string; note: string }[] = [
  { id: 'webm', label: 'WebM', note: 'VP8 video and Opus audio: plays in every browser.' },
  { id: 'mp4', label: 'MP4', note: 'MPEG-4 Part 2 video and AAC audio, for QuickTime, VLC, phones and editors. Browsers don’t play this video codec (H.264 needs an encoder this LGPL build doesn’t include).' },
  { id: 'gif', label: 'GIF', note: 'An animated GIF, up to 480 pixels wide and 15 frames a second, without sound.' },
  { id: 'mp3', label: 'MP3', note: 'The soundtrack only.' },
  { id: 'wav', label: 'WAV', note: 'The soundtrack only, uncompressed.' },
];
const SIZES = [{ id: 'full', label: 'Full' }, { id: '720', label: '720p' }, { id: '480', label: '480p' }, { id: '360', label: '360p' }];

/** The one key of a single-selection change (react-aria hands over a Set, or 'all'). */
const one = (keys: 'all' | Set<string | number>) => (keys === 'all' ? '' : String([...keys][0] ?? ''));

/** Whether a <video> here plays what the encoder wrote (an MP4 holds MPEG-4 Part 2, which Chrome and Firefox don't decode). */
const playable = (mime: string) =>
  typeof document === 'undefined' || !!document.createElement('video').canPlayType(mime === 'video/mp4' ? 'video/mp4; codecs="mp4v.20.9"' : mime);

/** The project at an export size: `720p` means the short side is 720 (never larger than the project). */
function scaled(format: TimelineFormat, size: string): TimelineFormat {
  const short = Math.min(format.width, format.height);
  const k = size === 'full' ? 1 : Math.min(1, Number(size) / short);
  const even = (x: number) => Math.max(2, Math.round((x * k) / 2) * 2);
  return { ...format, width: even(format.width), height: even(format.height) };
}

/** Titles drawn to PNGs, and what every clip plays, ready for buildRender. */
async function prepare(project: Project, media: Record<string, MediaItem>, format: TimelineFormat) {
  const out: Record<string, RenderMedia> = {};
  for (const m of Object.values(media)) if (m.status === 'ready') out[m.id] = { file: m.file, kind: m.kind, hasAudio: m.hasAudio };
  const tracks = await Promise.all(project.timeline.tracks.map(async (t) => ({
    ...t,
    clips: await Promise.all(t.clips.map(async (c) => {
      if (!isTitle(c)) return c;
      const id = `title-${c.id}`;
      out[id] = { file: await titlePng(titleData(c), format), kind: 'image', hasAudio: false };
      return { ...c, media: id };
    })),
  })));
  return { timeline: { tracks } satisfies Timeline, media: out };
}

type Phase =
  | { at: 'setup' }
  | { at: 'running'; progress: FfmpegProgress | null; started: number }
  | { at: 'done'; url: string; size: number; mime: string; ms: number }
  | { at: 'error'; message: string; stderr?: string };

export function ExportDialog({ ffmpeg, engine, project, media }: { ffmpeg: Ffmpeg | null; engine: string | null | undefined; project: Project; media: Record<string, MediaItem> }) {
  const [container, setContainer] = useState<RenderContainer>('webm');
  const [quality, setQuality] = useState<RenderQuality>('medium');
  const [size, setSize] = useState('full');
  const [phase, setPhase] = useState<Phase>({ at: 'setup' });
  const [plan, setPlan] = useState<RenderPlan | null>(null);
  const abort = useRef<AbortController | null>(null);
  const duration = timelineDuration(project.timeline);
  const audioOnly = container === 'mp3' || container === 'wav';
  const format = scaled(project.format, size);
  const reset = () => {
    abort.current?.abort();
    abort.current = null;
    setPhase((p) => { if (p.at === 'done') URL.revokeObjectURL(p.url); return { at: 'setup' }; });
  };
  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    if (!ffmpeg) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    const started = performance.now();
    setPhase({ at: 'running', progress: null, started });
    try {
      const prepared = await prepare(project, media, format);
      const p = buildRender(prepared.timeline, prepared.media, format, { container, quality, background: project.background });
      setPlan(p);
      const { files } = await ffmpeg.run({
        args: p.args, inputs: p.inputs, duration: p.duration, signal: ctrl.signal,
        onProgress: (progress) => setPhase((ph) => (ph.at === 'running' ? { ...ph, progress } : ph)),
      });
      const blob = new Blob([files[p.output] as Uint8Array<ArrayBuffer>], { type: p.mime });
      setPhase({ at: 'done', url: URL.createObjectURL(blob), size: blob.size, mime: p.mime, ms: performance.now() - started });
    } catch (e) {
      if (e instanceof FfmpegError && e.code === 'aborted') setPhase({ at: 'setup' });
      else setPhase({ at: 'error', message: e instanceof Error ? e.message : String(e), stderr: e instanceof FfmpegError ? e.stderr : undefined });
    } finally {
      if (abort.current === ctrl) abort.current = null;
    }
  };

  const fileName = `${(project.name || 'Video').replace(/[^\w\- ]+/g, '').trim() || 'Video'}.${container}`;
  return (
    <DialogTrigger onOpenChange={(open) => { if (!open) reset(); }}>
      <Button size="sm" isDisabled={duration <= 0} title={duration <= 0 ? 'Add something to the timeline first' : undefined}>
        <Icon name="share" size={15} /> Export
      </Button>
      <DialogContent size="lg" isDismissable={phase.at !== 'running'}>
        {phase.at !== 'running' ? <DialogClose /> : null}
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            {engine ? engine : `${format.width} × ${format.height} at ${format.fps} fps, ${duration.toFixed(1)} s. Rendered on this device by FFmpeg in WebAssembly.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 px-5 pb-5">
          {phase.at === 'setup' ? (
            <>
              <ToggleGroup aria-label="Format" variant="filled" size="sm" selectionMode="single" disallowEmptySelection className="w-full"
                selectedKeys={[container]} onSelectionChange={(k) => setContainer((one(k) || 'webm') as RenderContainer)}>
                {CONTAINERS.map((c) => <ToggleGroupItem key={c.id} id={c.id} className="flex-1">{c.label}</ToggleGroupItem>)}
              </ToggleGroup>
              <p className="m-0 text-footnote text-muted-foreground">{CONTAINERS.find((c) => c.id === container)?.note}</p>
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
                <span className="text-footnote font-medium">Quality</span>
                <ToggleGroup aria-label="Quality" variant="filled" size="sm" selectionMode="single" disallowEmptySelection
                  selectedKeys={[quality]} onSelectionChange={(k) => setQuality((one(k) || 'medium') as RenderQuality)}>
                  <ToggleGroupItem id="low" className="flex-1">Smaller</ToggleGroupItem>
                  <ToggleGroupItem id="medium" className="flex-1">Balanced</ToggleGroupItem>
                  <ToggleGroupItem id="high" className="flex-1">Best</ToggleGroupItem>
                </ToggleGroup>
                {!audioOnly ? (
                  <>
                    <span className="text-footnote font-medium">Size</span>
                    <ToggleGroup aria-label="Size" variant="filled" size="sm" selectionMode="single" disallowEmptySelection
                      selectedKeys={[size]} onSelectionChange={(k) => setSize(one(k) || 'full')}>
                      {SIZES.map((s) => <ToggleGroupItem key={s.id} id={s.id} className="flex-1">{s.label}</ToggleGroupItem>)}
                    </ToggleGroup>
                  </>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" slot="close">Cancel</Button>
                <Button isDisabled={!ffmpeg || !!engine || duration <= 0} onPress={run}>Export {CONTAINERS.find((c) => c.id === container)?.label}</Button>
              </div>
            </>
          ) : null}
          {phase.at === 'running' ? (
            <>
              <Progress label="Rendering" showValue value={Math.round((phase.progress?.fraction ?? 0) * 100)} isIndeterminate={!phase.progress} />
              <p className="m-0 text-footnote text-muted-foreground tabular-nums">
                {phase.progress
                  ? `${phase.progress.time.toFixed(1)} of ${duration.toFixed(1)} s${phase.progress.speed ? ` · ${phase.progress.speed.toFixed(1)}× realtime` : ''}`
                  : 'Drawing titles and starting FFmpeg…'}
              </p>
              <div className="flex justify-end">
                <Button variant="secondary" onPress={() => abort.current?.abort()}>Cancel</Button>
              </div>
            </>
          ) : null}
          {phase.at === 'done' ? (
            <>
              <div className="overflow-hidden rounded-panel bg-black">
                {phase.mime.startsWith('audio/')
                  ? <audio src={phase.url} controls className="block w-full" />
                  : phase.mime === 'image/gif'
                    ? <img src={phase.url} alt="The exported GIF" className="mx-auto block max-h-72" />
                    : playable(phase.mime)
                      ? <video src={phase.url} controls playsInline className="mx-auto block max-h-72 w-full" />
                      : <p className="m-0 p-6 text-center text-footnote text-white/80">This browser can’t play MPEG-4 Part 2 video. Download the file to watch it in QuickTime Player or VLC.</p>}
              </div>
              <p className="m-0 text-footnote text-muted-foreground tabular-nums">
                {fileName} · {formatBytes(phase.size)} · rendered in {(phase.ms / 1000).toFixed(1)} s
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onPress={reset}>Export again</Button>
                <a href={phase.url} download={fileName}
                  className="inline-flex h-9 items-center gap-2 rounded-ctl bg-primary px-4 text-subhead font-semibold text-primary-foreground no-underline">
                  <Icon name="download" size={15} /> Download
                </a>
              </div>
            </>
          ) : null}
          {phase.at === 'error' ? (
            <>
              <p role="alert" className="m-0 text-footnote text-destructive">{phase.message}</p>
              {phase.stderr ? <pre className="bl-scroll m-0 max-h-40 overflow-auto rounded-ctl bg-secondary p-2 text-caption2 whitespace-pre-wrap">{phase.stderr}</pre> : null}
              <div className="flex justify-end"><Button variant="secondary" onPress={reset}>Back</Button></div>
            </>
          ) : null}
          {plan && phase.at !== 'setup' ? (
            <details className="text-caption text-muted-foreground">
              <summary className="cursor-pointer select-none">FFmpeg command</summary>
              <pre className="bl-scroll m-0 mt-2 max-h-40 overflow-auto rounded-ctl bg-secondary p-2 text-caption2 whitespace-pre-wrap text-foreground">
                ffmpeg {plan.args.map((a) => (/[\s;'[\]]/.test(a) ? `"${a}"` : a)).join(' ')}
              </pre>
            </details>
          ) : null}
        </DialogBody>
      </DialogContent>
    </DialogTrigger>
  );
}

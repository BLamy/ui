/* Video Editor — a video editor in the browser, after iMovie and Final Cut: a media library, a viewer, an inspector and
   a timeline with a magnetic main track, titles over it and music under it. Rendering and media reading are FFmpeg
   (openclaw/ffmpeg-wasm, built by tools/ffmpeg-wasm) in workers on this device: probing, filmstrips, waveforms and the
   export to MP4, WebM, GIF, MP3 or WAV. The viewer plays the edit live, without rendering.
   Keys: Space play/pause · J/K/L back, pause, play · ←/→ a frame (⇧ a second) · Home/End · S split · T title ·
   ⌫ delete · ⌘D duplicate · ⌘A select all · ⌘Z/⇧⌘Z undo/redo · ⌘+/⌘− zoom · ⌥-drag to place without snapping.
   FFmpeg's threads need a cross-origin isolated page; without one the browser reads and plays what it can, and
   exporting is off. The sample clips are made by FFmpeg's test sources when the editor opens. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerShortcut, useShortcutHint } from '@ui-sdk/react/shortcuts';
import { AdaptivePane, AdaptivePaneTrigger, createAdaptivePaneController } from '@/components/ui/adaptive-pane';
import { Button } from '@/components/ui/button';
import { Filmstrip } from '@/components/ui/filmstrip';
import { Slider } from '@/components/ui/slider';
import { Toggle, toggleVariants } from '@/components/ui/toggle';
import { VideoPreviewControls, VideoPreview, type PreviewMedia } from '@/components/ui/video-preview';
import { fitTimelineZoom, timelineZoomRange, VideoTimeline, type TimelineMediaInfo } from '@/components/ui/video-timeline';
import { Waveform } from '@/components/ui/waveform';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import { FfmpegProvider, releaseMedia, useFfmpeg, useFfmpegSupport, useMediaFrames, useMediaPeaks } from '@/lib/ffmpeg/react';
import { Icon, type IconShape } from '@/lib/icon';
import { usePlaybackClock } from '@/lib/playback';
import { BLProvider } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { clipDuration, removeClips, timelineDuration, type Timeline, type TimelineClip, type TimelineTrack } from '@/lib/video-timeline-model';
import { useActions } from './actions';
import { ExportDialog } from './export-dialog';
import { Inspector } from './inspector';
import { kindOf, newMediaItem, probeItem } from './media';
import { MediaPanel, type SamplesState } from './media-panel';
import { makeSamples, starterTimeline, type SampleFile } from './samples';
import { EditorProvider, useEditor, type MediaItem, type Project } from './store';
import { isTitle, TITLE_MEDIA, titleData, TitleView } from './titles';

export interface VideoEditorProps {
  /** Where the FFmpeg build is served (ffmpeg-worker.js and the wasm). Default `ffmpeg/` against the page. */
  ffmpegURL?: string;
  /** Make the sample clips and a first edit when the editor opens (FFmpeg must be able to run). Default true. */
  samples?: boolean;
  /** The project's name. */
  defaultName?: string;
}

const EMPTY: Timeline = {
  tracks: [
    { id: 'titles', kind: 'video', name: 'Titles', clips: [] },
    { id: 'main', kind: 'video', name: 'Main', magnetic: true, clips: [] },
    { id: 'music', kind: 'audio', name: 'Music', clips: [] },
  ],
};

const SCISSORS: IconShape[] = [{ c: [6.5, 17.5, 2.6] }, { c: [17.5, 17.5, 2.6] }, { d: 'M8.3 15.6L17.6 4.2' }, { d: 'M15.7 15.6L6.4 4.2' }];

export default function VideoEditor({ ffmpegURL, samples = true, defaultName = 'My Movie' }: VideoEditorProps) {
  const project: Project = { name: defaultName, format: { width: 1280, height: 720, fps: 30 }, background: 'black', timeline: EMPTY };
  return (
    <BLProvider>
      <FfmpegProvider baseURL={ffmpegURL}>
        <EditorProvider project={project}>
          <Shell samples={samples} />
        </EditorProvider>
      </FfmpegProvider>
    </BLProvider>
  );
}

/** A toolbar button that opens a side drawer: the kit's toggle look, tinted while its pane shows. */
const paneTrigger = cn(toggleVariants({ size: 'sm' }), 'data-open:bg-primary/15 data-open:text-primary');

function Shell({ samples }: { samples: boolean }) {
  const ed = useEditor();
  const ffmpeg = useFfmpeg();
  const engine = useFfmpegSupport();
  const clock = usePlaybackClock();
  const act = useActions(clock);
  // Three columns (library, viewer, inspector) in a regular box; narrower, the side panels are drawers over the viewer.
  const [ref, sizeClass] = useSizeClass<HTMLDivElement>({ breakpoints: { medium: 640, regular: 960 } });
  const wide = sizeClass === 'regular';
  const [panel, setPanel] = useState<'media' | 'inspector' | null>(null);
  // The toolbar's pane triggers reach the drawers through their controllers (AdaptivePaneTrigger).
  const [mediaPane] = useState(createAdaptivePaneController);
  const [inspectorPane] = useState(createAdaptivePaneController);
  const [zoom, setZoom] = useState(60);
  const [snap, setSnap] = useState(true);
  const [sampling, setSampling] = useState<SamplesState>({ status: 'idle' });
  const timelineBox = useRef<HTMLDivElement | null>(null);
  const { project } = ed;
  const fps = project.format.fps;
  const runner = engine === null ? ffmpeg : null;

  const duration = timelineDuration(project.timeline);
  useEffect(() => { clock.setDuration(duration); }, [clock, duration]);

  /* ── Media ── */
  const importFiles = (files: File[]) => {
    for (const file of files) {
      const kind = kindOf(file);
      if (!kind) continue;
      const item = newMediaItem(file, kind);
      ed.addMedia(item);
      void probeItem(item, runner).then((patch) => ed.patchMedia(item.id, patch));
    }
  };
  const removeMedia = (id: string) => {
    const m = ed.media[id];
    const used = project.timeline.tracks.flatMap((t) => t.clips.filter((c) => c.media === id).map((c) => c.id));
    if (used.length) ed.edit((t) => removeClips(t, used));
    ed.removeMedia(id);
    if (m) { URL.revokeObjectURL(m.url); releaseMedia(m.file); }
  };
  const fit = () => {
    const w = timelineBox.current?.clientWidth ?? 1200;
    setZoom(fitTimelineZoom(Math.max(duration, 5), w));
  };
  const makeSampleMedia = async (startEdit: boolean) => {
    if (!runner) return;
    setSampling({ status: 'making' });
    try {
      const files = await makeSamples(runner);
      const ids = {} as Record<SampleFile['key'], string>;
      const items = files.map(({ key, file }) => {
        const item = newMediaItem(file, file.type.startsWith('audio') ? 'audio' : 'video');
        ids[key] = item.id;
        ed.addMedia(item);
        return item;
      });
      await Promise.all(items.map((item) => probeItem(item, runner).then((patch) => ed.patchMedia(item.id, patch))));
      if (startEdit) {
        const starter = starterTimeline(ids);
        ed.commit((p) => (timelineDuration(p.timeline) > 0 ? p : { ...p, timeline: starter }));
        // Fit the edit, and park on a frame under the title rather than the black of the opening fade.
        clock.setDuration(timelineDuration(starter));
        clock.seek(1.5);
        requestAnimationFrame(() => setZoom(fitTimelineZoom(timelineDuration(starter) + 0.5, timelineBox.current?.clientWidth ?? 1200)));
      }
      setSampling({ status: 'done' });
    } catch (e) {
      setSampling({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  };
  // The first open makes the samples and a first edit (once, even under StrictMode's double effects).
  const started = useRef(false);
  useEffect(() => {
    if (!samples || started.current || engine !== null || !ffmpeg) return;
    started.current = true;
    void makeSampleMedia(true);
    // Once, when FFmpeg is ready.
  }, [samples, engine, ffmpeg]);

  /* ── What the viewer and the timeline see ── */
  const ready = ed.order.map((id) => ed.media[id]).filter((m): m is MediaItem => !!m);
  const preview: Record<string, PreviewMedia> = {};
  const info: Record<string, TimelineMediaInfo> = { [TITLE_MEDIA]: { duration: Infinity, kind: 'image', name: 'Title' } };
  for (const m of ready) {
    if (m.status !== 'ready') continue;
    preview[m.id] = { url: m.url, kind: m.kind };
    info[m.id] = { duration: m.duration, kind: m.kind, name: m.name };
  }

  /* ── Keys ── */
  // Page shortcuts (UI SDK's registry) that act only while focus is inside this editor; text fields keep their
  // keys and an open dialog pauses them.
  const root = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback((el: HTMLDivElement | null) => { root.current = el; ref(el); }, [ref]);
  const step = (by: number) => { clock.pause(); clock.seek(clock.getState().time + by); };
  const zoomBy = (f: number) => setZoom((z) => Math.min(timelineZoomRange.max, Math.max(timelineZoomRange.min, z * f)));
  const bindings: [keys: string, run: () => void, description?: string][] = [
    ['mod+z', ed.undo, 'Undo'],
    ['shift+mod+z', ed.redo, 'Redo'],
    ['mod+y', ed.redo],
    ['mod+a', act.selectAll, 'Select all clips'],
    ['mod+d', act.duplicate, 'Duplicate'],
    ['mod+=', () => zoomBy(1.5), 'Zoom in'],
    ['mod+-', () => zoomBy(1 / 1.5), 'Zoom out'],
    ['space', clock.toggle, 'Play or pause'],
    ['k', clock.pause, 'Pause'],
    ['l', clock.play, 'Play'],
    ['j', () => step(-2), 'Back two seconds'],
    ['left', () => step(-1 / fps), 'Back a frame'],
    ['right', () => step(1 / fps), 'Forward a frame'],
    ['shift+left', () => step(-1), 'Back a second'],
    ['shift+right', () => step(1), 'Forward a second'],
    ['home', () => clock.seek(0), 'Go to the start'],
    ['end', () => clock.seek(clock.getState().duration), 'Go to the end'],
    ['s', act.split, 'Split at the playhead'],
    ['t', () => act.addTitle(), 'Add a title'],
    ['backspace', act.remove, 'Delete'],
    ['delete', act.remove],
    ['escape', () => ed.select([]), 'Deselect'],
  ];
  const latest = useRef(bindings);
  latest.current = bindings;
  useEffect(() => {
    const off = latest.current.map(([keys, , description], i) =>
      registerShortcut(keys, () => latest.current[i][1](), { when: () => !!root.current?.contains(document.activeElement), description }));
    return () => off.forEach((stop) => stop());
  }, []);
  const hint = { undo: useShortcutHint('mod+z'), redo: useShortcutHint('shift+mod+z') };

  const media = (
    <MediaPanel items={ready} onFiles={importFiles} onAdd={(id) => act.addMedia(id)} onRemove={removeMedia}
      samples={sampling} onSamples={() => void makeSampleMedia(false)} engine={engine} className="h-full" />
  );
  const inspector = <Inspector clock={clock} className="h-full" />;
  const side = 'box-border shrink-0 bg-background';
  return (
    <SizeClassProvider value={sizeClass}>
    <div ref={setRoot} data-slot="video-editor" tabIndex={-1}
      className="flex size-full flex-col overflow-hidden bg-background text-foreground outline-none">
      {/* Toolbar */}
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border px-2.5">
        {!wide ? (
          <AdaptivePaneTrigger controller={mediaPane} aria-label="Media" className={paneTrigger}>
            <Icon name="photo" size={16} />
          </AdaptivePaneTrigger>
        ) : null}
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-subhead font-semibold">{project.name}</div>
          <div className="truncate text-caption2 text-muted-foreground tabular-nums">
            {project.format.width} × {project.format.height} · {fps} fps · {runner ? 'FFmpeg ready' : engine === undefined ? 'Checking FFmpeg…' : 'Preview only'}
          </div>
        </div>
        <Button variant="quiet" size="icon-sm" aria-label="Undo" title={`Undo (${hint.undo.text})`} aria-keyshortcuts={hint.undo.ariaKeyshortcuts} disabled={!ed.canUndo} onClick={ed.undo}>
          <Icon name="arrow-uturn-backward" size={17} />
        </Button>
        <Button variant="quiet" size="icon-sm" aria-label="Redo" title={`Redo (${hint.redo.text})`} aria-keyshortcuts={hint.redo.ariaKeyshortcuts} disabled={!ed.canRedo} onClick={ed.redo}>
          <Icon name="arrow-uturn-forward" size={17} />
        </Button>
        {!wide ? (
          <AdaptivePaneTrigger controller={inspectorPane} aria-label="Inspector" className={paneTrigger}>
            <Icon name="sliders" size={16} />
          </AdaptivePaneTrigger>
        ) : null}
        <ExportDialog ffmpeg={runner} engine={engine} project={project} media={ed.media} />
      </header>

      {/* Library, viewer, inspector */}
      <div className="relative flex min-h-0 flex-1">
        <AdaptivePane controller={mediaPane} presentation={wide ? 'column' : 'drawer'} side="start" aria-label="Media" open={wide || panel === 'media'}
          onOpenChange={(open) => setPanel(open ? 'media' : null)} columnWidth={256} className={cn(side, 'border-r border-border')}>
          {media}
        </AdaptivePane>
        <div className="flex min-w-0 flex-1 flex-col bg-muted">
          <VideoPreview timeline={project.timeline} media={preview} playback={clock} format={project.format} className="min-h-0 flex-1 p-3"
            renderClip={(clip) => (isTitle(clip) ? <TitleView clip={clip} format={project.format} /> : undefined)}>
            {duration <= 0 ? (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-footnote text-white/70">
                {sampling.status === 'making' ? 'Making sample clips with FFmpeg…' : 'Add media from the library, or drop files on it, to start.'}
              </div>
            ) : null}
          </VideoPreview>
          <div className="flex shrink-0 items-center justify-center border-t border-border bg-background px-2 py-1">
            <VideoPreviewControls playback={clock} fps={fps} />
          </div>
        </div>
        <AdaptivePane controller={inspectorPane} presentation={wide ? 'column' : 'drawer'} side="end" aria-label="Inspector" open={wide || panel === 'inspector'}
          onOpenChange={(open) => setPanel(open ? 'inspector' : null)} columnWidth={288} className={cn(side, 'border-l border-border')}>
          {inspector}
        </AdaptivePane>
      </div>

      {/* Timeline */}
      <div ref={timelineBox} className="flex h-[40%] min-h-52 shrink-0 flex-col border-t border-border">
        <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
          <Button variant="quiet" size="icon-sm" aria-label="Split at the playhead" title="Split at the playhead (S)" aria-keyshortcuts="S" onClick={act.split}>
            <Icon shapes={SCISSORS} size={16} />
          </Button>
          <Button variant="quiet" size="icon-sm" aria-label="Delete" title="Delete (⌫)" aria-keyshortcuts="Backspace Delete" disabled={!ed.selection.length} onClick={act.remove}>
            <Icon name="trash" size={16} />
          </Button>
          <Button variant="quiet" size="icon-sm" aria-label="Add a title" title="Add a title (T)" aria-keyshortcuts="T" onClick={() => act.addTitle()}>
            <Icon name="textformat" size={16} />
          </Button>
          <div className="flex-1" />
          <Toggle size="sm" pressed={snap} onPressedChange={setSnap} className="h-7 px-2 text-caption">Snap</Toggle>
          <Slider aria-label="Zoom" size="sm" className="w-28" min={Math.log(timelineZoomRange.min)} max={Math.log(timelineZoomRange.max)} step={0.01}
            value={Math.log(zoom)} onValueChange={(v) => setZoom(Math.exp(v))} />
          <Button variant="quiet" size="sm" className="h-7 px-2 text-caption" onClick={fit}>Fit</Button>
        </div>
        <VideoTimeline className="min-h-0 flex-1" value={project.timeline} onValueChange={(t) => ed.edit(() => t)} media={info} playback={clock} fps={fps}
          selectedClips={ed.selection} onSelectedClipsChange={ed.select} zoom={zoom} onZoomChange={setZoom} snap={snap}
          onDropMedia={(id, details) => act.addMedia(id, details)}
          clipClassName={(clip) => (isTitle(clip) ? 'border-chart-5/55 bg-chart-5/25' : ed.media[clip.media]?.kind === 'image' ? 'border-chart-3/50 bg-chart-3/20' : undefined)}
          renderClip={(clip, track, { width }) => <ClipBody clip={clip} track={track} width={width} />} />
      </div>
    </div>
    </SizeClassProvider>
  );
}

/** What a clip shows on the timeline: frames (and the sound under them on the main track), a waveform, or a title. */
function ClipBody({ clip, track, width }: { clip: TimelineClip; track: TimelineTrack; width: number }) {
  const ed = useEditor();
  const m = ed.media[clip.media];
  const ready = m?.status === 'ready' ? m : null;
  const video = ready && ready.kind === 'video' && track.kind === 'video' ? ready.file : null;
  const sound = ready && ready.hasAudio && ready.kind !== 'image' && (track.kind === 'audio' || track.magnetic) ? ready.file : null;
  const count = ready ? Math.max(6, Math.min(48, Math.round(ready.duration / 0.75))) : 0;
  const frames = useMediaFrames(video, { count, height: 64 });
  const peaks = useMediaPeaks(sound);
  if (isTitle(clip)) {
    return <div className="flex h-full items-end truncate px-2 pb-1 text-caption2 text-foreground/80">{titleData(clip).text}</div>;
  }
  if (!ready || width < 6) return null;
  const strip = track.kind === 'video' && ready.kind !== 'audio';
  const wave = peaks.data ? <Waveform peaks={peaks.data.peaks} rate={peaks.data.rate} from={clip.in} to={clip.out} gain={clip.muted ? 0 : clip.volume ?? 1} tone={strip ? 'default' : 'success'} /> : null;
  if (!strip) return <div className="absolute inset-x-0 top-4 bottom-0.5">{wave}</div>;
  const images = ready.kind === 'image' ? [{ time: 0, src: ready.url }] : frames.data ?? [];
  return (
    <>
      <div className={cn('absolute inset-x-0 top-0 opacity-90', sound ? 'bottom-3' : 'bottom-0')}>
        <Filmstrip frames={images} loading={ready.kind === 'image' ? false : frames.loading} from={ready.kind === 'image' ? 0 : clip.in} to={ready.kind === 'image' ? 0 : clip.out} />
      </div>
      {sound ? <div className="absolute inset-x-0 bottom-0 h-3 bg-black/25">{wave}</div> : null}
      {clipDuration(clip) && clip.look ? <div className="absolute right-1 bottom-3.5 rounded-sm bg-background/70 px-1 text-caption2">{clip.look}</div> : null}
    </>
  );
}

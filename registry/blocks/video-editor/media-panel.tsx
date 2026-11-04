import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FileDropZone } from '@/components/ui/file-upload';
import { HoverCard, HoverCardHeader, useHoverCard } from '@/components/ui/hover-card';
import { Spinner } from '@/components/ui/spinner';
import { timelineMediaType } from '@/components/ui/video-timeline';
import { Waveform } from '@/components/ui/waveform';
import { useMediaFrames, useMediaPeaks } from '@/lib/ffmpeg/react';
import { formatBytes } from '@/lib/format-bytes';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { formatTimecode } from '@/lib/video-timeline-model';
import { useEditor, type MediaItem } from './store';

/* The media library: drop or browse for files (or make the samples), then drag a card onto a track, or press its +
   to add it (pictures at the end of the main track, sound at the playhead). Resting on a card previews the file in a
   hover card, as a browser in Final Cut does: a bigger frame, its length, size, picture and sound, and how many clips
   on the timeline play it. The inspector's clip name shows the same card for the clip's source. */

export type SamplesState = { status: 'idle' | 'making' | 'done' } | { status: 'error'; error: string };

export interface MediaPanelProps {
  items: MediaItem[];
  onFiles: (files: File[]) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  samples: SamplesState;
  onSamples: () => void;
  /** Why FFmpeg can't run here (null when it can, undefined while checking). */
  engine: string | null | undefined;
  className?: string;
}

const KIND_ICON: Record<MediaItem['kind'], string> = { video: 'video', audio: 'waveform', image: 'photo' };

export function MediaPanel({ items, onFiles, onAdd, onRemove, samples, onSamples, engine, className }: MediaPanelProps) {
  return (
    <section aria-label="Media" className={cn('flex min-h-0 flex-col', className)}>
      <header className="flex h-10 shrink-0 items-center gap-2 px-3">
        <h2 className="m-0 flex-1 text-footnote font-semibold text-foreground">Media</h2>
        <Button variant="quiet" size="sm" isDisabled={engine !== null || samples.status === 'making'} onPress={onSamples}
          title={engine ?? 'Make three sample clips and a music bed with FFmpeg'}>
          {samples.status === 'making' ? <Spinner size={14} /> : <Icon name="plus" size={14} />}
          Samples
        </Button>
      </header>
      <div className="bl-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <FileDropZone size="compact" title="Import media" hint=""
          rules={{ accept: ['video/*', 'audio/*', 'image/*'] }} icon="video" browseLabel="Browse"
          onFiles={(entries) => onFiles(entries.map((e) => e.file))} />
        {samples.status === 'error' ? <p className="mt-2 mb-0 text-caption text-destructive">{samples.error}</p> : null}
        {items.length ? (
          <ul className="m-0 mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 p-0">
            {items.map((m) => <MediaCard key={m.id} item={m} onAdd={() => onAdd(m.id)} onRemove={() => onRemove(m.id)} />)}
          </ul>
        ) : (
          <p className="mt-3 mb-0 text-caption leading-snug text-muted-foreground">
            {engine === null
              ? 'Your files stay on this device: FFmpeg runs here, in WebAssembly.'
              : engine
                ? 'FFmpeg can’t run in this page, so the browser reads your files instead (what it can play) and exporting is off.'
                : null}
          </p>
        )}
      </div>
    </section>
  );
}

const KIND_WORD: Record<MediaItem['kind'], string> = { video: 'Video', audio: 'Audio', image: 'Still image' };

/** A media file's hover card: the frame (or waveform) large, then its facts and its uses on the timeline. */
export function MediaPreview({ item: m }: { item: MediaItem }) {
  const ed = useEditor();
  const uses = ed.project.timeline.tracks.reduce((n, t) => n + t.clips.filter((c) => c.media === m.id).length, 0);
  const facts = [
    m.kind !== 'image' && m.status === 'ready' ? formatTimecode(m.duration) : null,
    m.width && m.height ? `${m.width} × ${m.height}` : null,
    m.kind === 'video' ? (m.hasAudio ? 'with sound' : 'no sound') : null,
    formatBytes(m.file.size) || null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative aspect-video overflow-hidden rounded-ctl bg-black"><Thumb item={m} /></div>
      <HoverCardHeader title={m.name} subtitle={KIND_WORD[m.kind] + (m.file.type ? ` · ${m.file.type}` : '')} />
      {facts.length ? <p className="m-0 font-mono text-caption text-muted-foreground tabular-nums">{facts.join(' · ')}</p> : null}
      <p className="m-0 text-footnote text-muted-foreground">
        {m.status === 'error' ? m.error ?? 'Couldn’t read this file.'
          : m.status === 'loading' ? 'Reading the file…'
            : uses ? `In ${uses} ${uses === 1 ? 'clip' : 'clips'} on the timeline.` : 'Not on the timeline yet: drag it onto a track.'}
      </p>
    </div>
  );
}

function MediaCard({ item: m, onAdd, onRemove }: { item: MediaItem; onAdd: () => void; onRemove: () => void }) {
  const ready = m.status === 'ready';
  const hover = useHoverCard<HTMLLIElement>();
  return (
    <li draggable={ready} aria-label={m.name} {...hover.triggerProps}
      onDragStart={(e) => { hover.close(); e.dataTransfer.setData(timelineMediaType, m.id); e.dataTransfer.effectAllowed = 'copy'; }}
      className={cn('group/card relative overflow-hidden rounded-ctl bg-secondary shadow-hairline', ready && 'cursor-grab active:cursor-grabbing')}>
      <div className="relative aspect-video overflow-hidden bg-black">
        <Thumb item={m} />
        {m.status === 'loading' ? <div className="absolute inset-0 grid place-items-center bg-black/40"><Spinner size={18} /></div> : null}
        {m.status === 'error' ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60 p-2 text-center text-caption2 text-white" title={m.error}>
            <span className="line-clamp-3">{m.error ?? 'Couldn’t read this file'}</span>
          </div>
        ) : null}
        {ready && m.kind !== 'image' ? (
          <span className="absolute right-1 bottom-1 rounded-sm bg-black/65 px-1 font-mono text-caption2 text-white tabular-nums">{formatTimecode(m.duration)}</span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-1 px-1.5 py-1">
        <Icon name={KIND_ICON[m.kind]} size={12} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-caption2 font-medium text-foreground">{m.name}</span>
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100">
        <CardButton label={`Remove ${m.name}`} onPress={onRemove}><Icon name="trash" size={13} /></CardButton>
        <CardButton label={`Add ${m.name} to the timeline`} onPress={onAdd} disabled={!ready}><Icon name="plus" size={13} /></CardButton>
      </div>
      <HoverCard {...hover.cardProps} placement="end top" className="w-64"><MediaPreview item={m} /></HoverCard>
    </li>
  );
}

function CardButton({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Button variant="secondary" size="icon-sm" aria-label={label} isDisabled={disabled} onPress={onPress}
      className="bg-black/60 text-white data-hovered:bg-black/80">
      {children}
    </Button>
  );
}

/** A frame for video (FFmpeg's, else the browser's first frame), the image itself, or the waveform. */
function Thumb({ item: m }: { item: MediaItem }) {
  const frames = useMediaFrames(m.kind === 'video' && m.status === 'ready' ? m.file : null, { count: 1, height: 96 });
  const peaks = useMediaPeaks(m.kind === 'audio' && m.status === 'ready' ? m.file : null, { rate: 20 });
  if (m.kind === 'image') return <img src={m.url} alt="" className="size-full object-cover" draggable={false} />;
  if (m.kind === 'audio') {
    return (
      <div className="grid size-full place-items-center bg-success/15 px-1.5 text-success">
        {peaks.data ? <Waveform peaks={peaks.data.peaks} rate={peaks.data.rate} tone="success" className="h-3/4" /> : <Icon name="waveform" size={22} />}
      </div>
    );
  }
  const src = frames.data?.[0]?.src;
  if (src) return <img src={src} alt="" className="size-full object-cover" draggable={false} />;
  // No FFmpeg here: let the browser show the first frame, if it can play the file.
  return frames.error ? <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" /> : null;
}

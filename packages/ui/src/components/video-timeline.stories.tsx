import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Filmstrip, type FilmstripFrame } from '@/components/ui/filmstrip';
import { VideoTimeline, type TimelineMediaInfo } from '@/components/ui/video-timeline';
import { Waveform } from '@/components/ui/waveform';
import { usePlaybackClock } from '@/lib/playback';
import { BLProvider } from '@/lib/theme';
import { layoutTrack, timelineDuration, updateTrack, type Timeline, type TimelineClip, type TimelineTrack } from '@/lib/video-timeline';

/* ── Synthetic media: no files, no FFmpeg — the same pixels on every run ── */

/** A title clip plays no file; its text is in `clip.data`. */
const TITLE = '@title';
const RATE = 50;

/** One frame a second: an SVG card in the source's colour family with its second written on it. */
function frameSrc(hue: number, i: number): string {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90">'
    + `<rect width="160" height="90" fill="hsl(${hue + i * 4},55%,${34 + (i % 3) * 6}%)"/>`
    + `<circle cx="${24 + i * 16}" cy="30" r="13" fill="#fff" fill-opacity=".28"/>`
    + `<text x="148" y="80" text-anchor="end" fill="#fff" font-weight="700" font-family="ui-monospace,Menlo,monospace" font-size="22">${i}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
const framesOf = (seconds: number, hue: number): FilmstripFrame[] => Array.from({ length: seconds }, (_, i) => ({ time: i, src: frameSrc(hue, i) }));

/** Peaks from a fixed function: a swell, a beat and a grain. */
const peaksOf = (seconds: number, beat: number): number[] => Array.from({ length: seconds * RATE }, (_, i) => {
  const t = i / RATE;
  const swell = 0.35 + 0.65 * Math.abs(Math.sin((Math.PI * t) / seconds));
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(Math.PI * beat * t)) ** 3;
  return Math.min(1, swell * pulse * (0.8 + 0.2 * Math.abs(Math.sin(i * 12.9898))));
});

const MEDIA: Record<string, TimelineMediaInfo> = {
  [TITLE]: { duration: Infinity, kind: 'image', name: 'Title' },
  harbour: { duration: 8, kind: 'video', name: 'Harbour.mov' },
  market: { duration: 8, kind: 'video', name: 'Market.mov' },
  night: { duration: 8, kind: 'video', name: 'Night.mov' },
  score: { duration: 16, kind: 'audio', name: 'Score.mp3' },
};
const FRAMES: Record<string, FilmstripFrame[]> = { harbour: framesOf(8, 200), market: framesOf(8, 18), night: framesOf(8, 258) };
const PEAKS: Record<string, number[]> = { score: peaksOf(16, 2) };

/* ── The edit: titles over a magnetic main track (two dissolves), music under it — like the Video Editor block ── */

const TIMELINE: Timeline = {
  tracks: [
    {
      id: 'titles', kind: 'video', name: 'Titles',
      clips: [
        { id: 'title-open', media: TITLE, label: 'Title', start: 0.4, in: 0, out: 3, fadeIn: 0.4, fadeOut: 0.4, data: { text: 'Harbour Days' } },
        { id: 'title-lower', media: TITLE, label: 'Lower third', start: 6.2, in: 0, out: 3.6, fadeIn: 0.3, fadeOut: 0.3, data: { text: 'Filmed at dawn' } },
      ],
    },
    layoutTrack({
      id: 'main', kind: 'video', name: 'Main', magnetic: true,
      clips: [
        { id: 'main-harbour', media: 'harbour', start: 0, in: 0.5, out: 5, fadeIn: 0.6 },
        { id: 'main-market', media: 'market', start: 0, in: 0.5, out: 5.5, transition: 1 },
        { id: 'main-night', media: 'night', start: 0, in: 1, out: 5.5, transition: 0.8, look: 'vintage', fadeOut: 1 },
      ],
    }),
    {
      id: 'music', kind: 'audio', name: 'Music',
      clips: [{ id: 'music-score', media: 'score', start: 0, in: 0, out: 12, volume: 0.8, fadeOut: 1.5 }],
    },
  ],
};

const isTitle = (clip: TimelineClip) => clip.media === TITLE;

/** What a clip shows: its title text, a filmstrip of its frames, or the waveform of its sound. */
function ClipBody({ clip, track }: { clip: TimelineClip; track: TimelineTrack }) {
  if (isTitle(clip)) {
    return <div className="flex h-full items-end truncate px-2 pb-1 text-caption2 text-foreground/80">{String(clip.data?.text ?? '')}</div>;
  }
  if (track.kind === 'audio') {
    return (
      <div className="absolute inset-x-0 top-4 bottom-0.5">
        <Waveform peaks={PEAKS[clip.media] ?? []} rate={RATE} from={clip.in} to={clip.out} gain={clip.volume ?? 1} tone="success" />
      </div>
    );
  }
  return <Filmstrip frames={FRAMES[clip.media] ?? []} from={clip.in} to={clip.out} aspect={16 / 9} className="opacity-90" />;
}

/* ── The story ── */

interface Args {
  /** Pixels per second. */
  zoom: number;
  /** Where the playhead is parked, seconds. */
  time: number;
  /** Frames per second: edits land on frames; the ruler and the readout count them. */
  fps: number;
  /** Snap moves and trims to clip edges, the playhead and 0. */
  snap: boolean;
  /** Leaves out `onChange`: clips still select, but nothing moves and the track toggles are off. */
  readOnly: boolean;
}

/** Owns the timeline (each edit lands through `onChange`), the selection and the playback clock. */
function TimelineDemo({ zoom, time, fps, snap, readOnly, initial = TIMELINE, selected = [] }: Args & { initial?: Timeline; selected?: string[] }) {
  const [timeline, setTimeline] = useState(initial);
  const [selection, setSelection] = useState(selected);
  const clock = usePlaybackClock({ time });
  const duration = timelineDuration(timeline);
  useEffect(() => { clock.setDuration(duration); }, [clock, duration]);
  useEffect(() => { clock.seek(time); }, [clock, time]);
  return (
    <VideoTimeline className="h-full" timeline={timeline} onChange={readOnly ? undefined : setTimeline} media={MEDIA} clock={clock} fps={fps}
      selection={selection} onSelectionChange={setSelection} zoom={zoom} snap={snap}
      clipClassName={(clip) => (isTitle(clip) ? 'border-chart-5/55 bg-chart-5/25' : undefined)}
      renderClip={(clip, track) => <ClipBody clip={clip} track={track} />} />
  );
}

/** The timeline is a container: the page's width, 300 px tall. */
function Frame({ dark, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <div className="relative h-[300px] w-full overflow-hidden">
      <BLProvider dark={dark}>{children}</BLProvider>
    </div>
  );
}

const meta: Meta<Args> = {
  title: 'Organisms/VideoTimeline',
  args: { zoom: 60, time: 2.5, fps: 30, snap: true, readOnly: false },
  argTypes: {
    zoom: { control: { type: 'range', min: 10, max: 300, step: 1 } },
    time: { control: { type: 'range', min: 0, max: 12, step: 0.1 } },
    fps: { control: 'inline-radio', options: [24, 25, 30, 60] },
  },
  decorators: [(Story, ctx) => <Frame dark={!!ctx.parameters.dark}><Story /></Frame>],
  render: (args) => <TimelineDemo {...args} />,
};
export default meta;
type Story = StoryObj<Args>;

/** Titles (a free track) over the magnetic Main track — three clips, the second and third dissolving in over the one
    before — and a music bed. Drag clips to move them, drag their edges to trim, click or drag the ruler to scrub;
    ⌥ places without snapping. */
export const Default: Story = {};

/** A clip selected: outlined, with its trim handles showing. */
export const Selected: Story = { render: (args) => <TimelineDemo {...args} selected={['main-market']} /> };

/** The Main track locked: dimmed, its clips select but don't move or trim, and nothing can be dropped on it. */
export const LockedTrack: Story = { render: (args) => <TimelineDemo {...args} initial={updateTrack(TIMELINE, 'main', { locked: true })} /> };

/** Without `onChange` the timeline only shows the edit: clips select, the ruler scrubs, nothing else changes. */
export const ReadOnly: Story = { args: { readOnly: true } };

export const Dark: Story = { parameters: { dark: true } };

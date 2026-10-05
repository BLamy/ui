import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlaybackControls, VideoPreview, type PreviewMedia } from '@/components/ui/video-preview';
import { usePlaybackClock, type Playback } from '@/lib/playback';
import {
  layoutTrack, timelineDuration, timelineLooks,
  type Timeline, type TimelineClip, type TimelineFormat, type TimelineLook,
} from '@/lib/video-timeline';
import { Phone } from '../stories/frame';

/* ── Synthetic media: SVG cards as images (no video files, no FFmpeg), so every run shows the same pixels ── */

type Size = Pick<TimelineFormat, 'width' | 'height'>;
const LANDSCAPE: Size = { width: 1280, height: 720 };
const PORTRAIT: Size = { width: 1080, height: 1920 };
const svgUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

/** A solid colour card with its name in the corner. */
function card(label: string, color: string, { width: w, height: h }: Size = LANDSCAPE): string {
  const u = Math.min(w, h) / 100;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<rect width="${w}" height="${h}" fill="${color}"/>`
    + `<circle cx="${w * 0.8}" cy="${h * 0.7}" r="${u * 18}" fill="#fff" fill-opacity=".16"/>`
    + `<text x="${u * 7}" y="${u * 17}" fill="#fff" font-family="-apple-system,'Helvetica Neue',Arial,sans-serif" font-size="${u * 10}" font-weight="800">${label}</text></svg>`);
}

/** Colour bars over a grey ramp: what a look does to colour shows at a glance. */
const BARS = ['#E5484D', '#F76B15', '#FFC53D', '#30A46C', '#0090FF', '#8E4EC6'];
const RAMP = ['#111111', '#3A3A3A', '#666666', '#939393', '#C2C2C2', '#F2F2F2'];
const SWATCHES = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">'
  + BARS.map((c, i) => `<rect x="${(i * 1280) / 6}" width="${1280 / 6 + 1}" height="500" fill="${c}"/>`).join('')
  + RAMP.map((c, i) => `<rect x="${(i * 1280) / 6}" y="500" width="${1280 / 6 + 1}" height="220" fill="${c}"/>`).join('')
  + '</svg>');

const MEDIA: Record<string, PreviewMedia> = {
  sunrise: { url: card('Sunrise', '#D9762B'), kind: 'image' },
  harbour: { url: card('Harbour', '#2F7FC1'), kind: 'image' },
  market: { url: card('Market', '#B83A4B'), kind: 'image' },
  inset: { url: card('Camera 2', '#2E9E6B'), kind: 'image' },
  swatches: { url: SWATCHES, kind: 'image' },
  tall: { url: card('Portrait', '#6E56C4', PORTRAIT), kind: 'image' },
};

/* ── Titles: clips with no file, drawn by `renderClip` as an SVG at the format's size (so they scale with the picture) ── */

const TITLE = '@title';
interface TitleData { text: string; style: 'center' | 'lower' }

function TitleCard({ clip, format }: { clip: TimelineClip; format: Size }) {
  const { text, style } = clip.data as unknown as TitleData;
  const { width: w, height: h } = format;
  const u = Math.min(w, h) / 100;
  if (style === 'center') {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="size-full font-sans drop-shadow-lg">
        <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="central" fontSize={u * 11} fontWeight={800} className="fill-white">{text}</text>
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="size-full font-sans">
      <rect y={h - u * 22} width={w} height={u * 14} className="fill-black/55" />
      <rect x={u * 6} y={h - u * 19.5} width={u * 0.8} height={u * 9} rx={u * 0.4} className="fill-primary" />
      <text x={u * 9} y={h - u * 15} dominantBaseline="central" fontSize={u * 5.5} fontWeight={700} className="fill-white">{text}</text>
    </svg>
  );
}
const titleClip = (clip: TimelineClip, format: Size) => (clip.media === TITLE ? <TitleCard clip={clip} format={format} /> : undefined);

/* ── The edit ── */

/** Titles over a picture-in-picture track over the magnetic main track: three cards, the second in `mono`, each
    dissolving in over the one before. */
const TIMELINE: Timeline = {
  tracks: [
    {
      id: 'titles', kind: 'video', name: 'Titles',
      clips: [
        { id: 'title-open', media: TITLE, start: 0.4, in: 0, out: 3, fadeIn: 0.4, fadeOut: 0.4, data: { text: 'Harbour Days', style: 'center' } },
        { id: 'title-lower', media: TITLE, start: 9, in: 0, out: 3, fadeIn: 0.3, fadeOut: 0.3, data: { text: 'Filmed at dawn', style: 'lower' } },
      ],
    },
    {
      id: 'overlay', kind: 'video', name: 'Overlay',
      clips: [{ id: 'pip-camera', media: 'inset', start: 5, in: 0, out: 4, fadeIn: 0.3, fadeOut: 0.3, fit: 'cover', frame: { x: 0.65, y: 0.06, width: 0.3, height: 0.3 } }],
    },
    layoutTrack({
      id: 'main', kind: 'video', name: 'Main', magnetic: true,
      clips: [
        { id: 'main-sunrise', media: 'sunrise', start: 0, in: 0, out: 4.5, fadeIn: 0.5 },
        { id: 'main-harbour', media: 'harbour', start: 0, in: 0, out: 5, transition: 1, look: 'mono' },
        { id: 'main-market', media: 'market', start: 0, in: 0, out: 4.5, transition: 0.8, fadeOut: 1 },
      ],
    }),
  ],
};

/** A portrait edit: one card filling the frame, a lower third over it. */
const TALL: Timeline = {
  tracks: [
    {
      id: 'titles', kind: 'video', name: 'Titles',
      clips: [{ id: 'tall-lower', media: TITLE, start: 0.5, in: 0, out: 3, fadeIn: 0.3, fadeOut: 0.3, data: { text: 'Filmed at dawn', style: 'lower' } }],
    },
    { id: 'main', kind: 'video', name: 'Main', magnetic: true, clips: [{ id: 'tall-card', media: 'tall', start: 0, in: 0, out: 6, fit: 'cover' }] },
  ],
};

/** One timeline per look: the colour bars, with that look. */
const LOOKS = timelineLooks.map(({ id, label }): { id: TimelineLook; label: string; timeline: Timeline } => ({
  id, label,
  timeline: { tracks: [{ id: 'main', kind: 'video', magnetic: true, clips: [{ id: `look-${id}`, media: 'swatches', start: 0, in: 0, out: 13, look: id }] }] },
}));

/* ── The stories ── */

interface Args {
  /** Where the clock is parked, seconds. */
  time: number;
  /** Frames per second, for the timecode and the frame steps. */
  fps: number;
}

/** A clock as long as the timeline, parked at `time` (and moved there when the control changes). */
function useParkedClock(timeline: Timeline, time: number): Playback {
  const clock = usePlaybackClock({ time });
  const duration = timelineDuration(timeline);
  useEffect(() => { clock.setDuration(duration); }, [clock, duration]);
  useEffect(() => { clock.pause(); clock.seek(time); }, [clock, time]);
  return clock;
}

/** The viewer and its transport, as in the Video Editor block. */
function PreviewDemo({ timeline, format, time, fps }: Args & { timeline: Timeline; format: Size }) {
  const clock = useParkedClock(timeline, time);
  return (
    <div className="flex h-full flex-col bg-muted">
      <VideoPreview className="min-h-0 flex-1 p-3" timeline={timeline} media={MEDIA} clock={clock} format={format}
        renderClip={(clip) => titleClip(clip, format)} />
      <div className="flex shrink-0 items-center justify-center border-t border-border bg-background px-2 py-1">
        <PlaybackControls clock={clock} fps={fps} />
      </div>
    </div>
  );
}

const meta: Meta<Args> = {
  title: 'Organisms/VideoPreview',
  args: { time: 1.5, fps: 30 },
  argTypes: {
    time: { control: { type: 'range', min: 0, max: 12.2, step: 0.1 } },
    fps: { control: 'inline-radio', options: [24, 25, 30, 60] },
  },
  parameters: { frame: { w: 640, h: 420 } },
  decorators: [(Story, ctx) => (
    <Phone w={ctx.parameters.frame.w} h={ctx.parameters.frame.h} dark={!!ctx.parameters.dark}><Story /></Phone>
  )],
};
export default meta;
type Story = StoryObj<Args>;

/** 1.5 s in: the first card under the opening title (a clip drawn by `renderClip`), the transport below. Play, step
    frames or scrub `time` to see the dissolves, the `mono` look and the picture in picture. */
export const Default: Story = { render: (args) => <PreviewDemo {...args} timeline={TIMELINE} format={LANDSCAPE} /> };

/** 6 s in: a clip with a `frame` sits in the top-right corner (cropped to fill it, `fit: 'cover'`) over the second
    card, whose `mono` look is a CSS filter on its picture. */
export const PictureInPicture: Story = {
  args: { time: 6 },
  render: (args) => <PreviewDemo {...args} timeline={TIMELINE} format={LANDSCAPE} />,
};

function LooksDemo({ time }: Args) {
  const clock = useParkedClock(LOOKS[0].timeline, time);
  return (
    <div className="grid h-full grid-cols-4 content-center gap-x-3 gap-y-4 bg-background p-5">
      {LOOKS.map((look) => (
        <figure key={look.id} className="m-0 flex min-w-0 flex-col gap-1.5">
          <div className="aspect-video overflow-hidden rounded-md ring-1 ring-border">
            <VideoPreview timeline={look.timeline} media={MEDIA} clock={clock} format={LANDSCAPE} />
          </div>
          <figcaption className="text-center text-caption text-muted-foreground">{look.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Every look on the same frame, one preview each, all on one clock. */
export const Looks: Story = {
  parameters: { frame: { w: 960, h: 360 } },
  render: (args) => <LooksDemo {...args} />,
};

/** A 1080 × 1920 format in a tall frame: the picture keeps the format's shape, as large as the box allows. */
export const Portrait: Story = {
  parameters: { frame: { w: 420, h: 760 } },
  render: (args) => <PreviewDemo {...args} timeline={TALL} format={PORTRAIT} />,
};

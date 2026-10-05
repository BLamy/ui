import type { CSSProperties, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Filmstrip, type FilmstripFrame, type FilmstripProps } from '@/components/ui/filmstrip';
import { Pad } from '../stories/frame';

/* Synthetic media: one frame a second, each an SVG card in its own colour with its second written on it, so the strip
   is the same on every run and nothing has to be decoded (no files, no FFmpeg). */
function frameSrc(i: number, w: number, h: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<rect width="${w}" height="${h}" fill="hsl(${(i * 30) % 360},58%,44%)"/>`
    + `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-weight="700"`
    + ` font-family="ui-monospace,Menlo,monospace" font-size="${Math.round(Math.min(w, h) * 0.46)}">${i}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
const framesOf = (seconds: number, w: number, h: number): FilmstripFrame[] =>
  Array.from({ length: seconds }, (_, i) => ({ time: i, src: frameSrc(i, w, h) }));

/** 16:9 frames at 0, 1, … 11 s. */
const LANDSCAPE = framesOf(12, 160, 90);
/** The same twelve seconds shot 9:16. */
const PORTRAIT = framesOf(12, 90, 160);

type Args = FilmstripProps & { width: number; height: number };

/** The strip fills its box; the story gives it one, `width` × `height`. */
function Box({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="h-(--h) w-(--w) overflow-hidden rounded-md bg-secondary"
      style={{ '--w': `${width}px`, '--h': `${height}px` } as CSSProperties}>
      {children}
    </div>
  );
}

const meta: Meta<Args> = {
  title: 'Molecules/Filmstrip',
  component: Filmstrip,
  args: { frames: LANDSCAPE, from: 0, to: 12, width: 600, height: 56 },
  argTypes: {
    frames: { control: false },
    from: { control: { type: 'range', min: 0, max: 12, step: 0.25 } },
    to: { control: { type: 'range', min: 0, max: 12, step: 0.25 } },
    aspect: { control: { type: 'number', min: 0.25, max: 4, step: 0.05 } },
    width: { control: { type: 'range', min: 40, max: 1000, step: 1 } },
    height: { control: { type: 'range', min: 16, max: 160, step: 1 } },
  },
  decorators: [(Story, ctx) => <Pad w={ctx.args.width + 40} dark={!!ctx.parameters.dark}><Story /></Pad>],
  render: ({ width, height, ...props }) => <Box width={width} height={height}><Filmstrip {...props} /></Box>,
};
export default meta;
type Story = StoryObj<Args>;

/** Twelve one-second frames across 600 × 56. Each cell (16:9, measured from the first frame) shows the frame nearest
    the time at its middle, so a strip with room for six cells shows every other second. */
export const Default: Story = {};

/** `from`/`to` are a clip's in and out points: seconds 3 to 7 across the same width, so the cells sample the range
    more finely than the frames and neighbours repeat a frame. */
export const SubRange: Story = { args: { from: 3, to: 7 } };

/** Portrait media: `aspect={9 / 16}` makes the cells narrow and tall, so more of them fit and every second shows. */
export const Portrait: Story = { args: { frames: PORTRAIT, aspect: 9 / 16, height: 80 } };

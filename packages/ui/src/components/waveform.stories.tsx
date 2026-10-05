import type { CSSProperties, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Waveform, type WaveformProps } from '@/components/ui/waveform';
import { Pad } from '../stories/frame';
import { Caption } from '../stories/primitive-frame';

/* Synthetic peaks, the same on every run: twelve seconds at 50 slices a second — two slow swells, a beat twice a
   second, and a fixed grain so neighbouring slices differ. */
const RATE = 50;
const PEAKS = Array.from({ length: 12 * RATE }, (_, i) => {
  const t = i / RATE;
  const swell = 0.3 + 0.7 * Math.abs(Math.sin((Math.PI * t) / 6));
  const beat = 0.35 + 0.65 * Math.abs(Math.sin(2 * Math.PI * t)) ** 4;
  const grain = 0.8 + 0.2 * Math.abs(Math.sin(i * 12.9898));
  return Math.min(1, swell * beat * grain);
});

const TONES = ['default', 'primary', 'success', 'muted'] as const;

type Args = WaveformProps & { width: number; height: number };

/** The waveform fills its box; the story gives it one, `width` × `height`. */
function Box({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="h-(--h) w-(--w) overflow-hidden rounded-md bg-background shadow-hairline"
      style={{ '--w': `${width}px`, '--h': `${height}px` } as CSSProperties}>
      {children}
    </div>
  );
}

const meta: Meta<Args> = {
  title: 'Molecules/Waveform',
  component: Waveform,
  args: { peaks: PEAKS, rate: RATE, variant: 'mirror', tone: 'default', gain: 1, width: 600, height: 64 },
  argTypes: {
    peaks: { control: false },
    rate: { control: false },
    variant: { control: 'inline-radio', options: ['mirror', 'bottom'] },
    tone: { control: 'inline-radio', options: TONES },
    gain: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    from: { control: { type: 'range', min: 0, max: 12, step: 0.1 } },
    to: { control: { type: 'range', min: 0, max: 12, step: 0.1 } },
    width: { control: { type: 'range', min: 40, max: 1000, step: 1 } },
    height: { control: { type: 'range', min: 8, max: 200, step: 1 } },
  },
  decorators: [(Story, ctx) => <Pad w={ctx.args.width + 40} dark={!!ctx.parameters.dark}><Story /></Pad>],
  render: ({ width, height, ...props }) => <Box width={width} height={height}><Waveform {...props} /></Box>,
};
export default meta;
type Story = StoryObj<Args>;

/** The whole twelve seconds, one bar per device pixel, mirrored around the middle (the default). */
export const Mirror: Story = {};

/** `variant="bottom"`: bars rise from the floor, as under a clip's frames. */
export const Bottom: Story = { args: { variant: 'bottom' } };

/** `from`/`to` zoom to seconds 2–4: a hundred slices across 600 px, each held over the columns it covers, so the
    strip stays continuous. */
export const ZoomedRange: Story = { args: { from: 2, to: 4 } };

/** `gain` scales the bars like a clip's volume: 0.4 here. */
export const Gain: Story = { args: { gain: 0.4 } };

/** The tones side by side: `default` (the text colour, 55 %), `primary`, `success` (audio clips) and `muted`. */
export const Tones: Story = {
  render: ({ width, height, ...props }) => (
    <div className="grid w-(--w) grid-cols-4 gap-3" style={{ '--w': `${width}px` } as CSSProperties}>
      {TONES.map((tone) => (
        <div key={tone} className="flex min-w-0 flex-col gap-1.5">
          <Caption>{tone}</Caption>
          <Box width={(width - 36) / 4} height={height}><Waveform {...props} tone={tone} /></Box>
        </div>
      ))}
    </div>
  ),
};

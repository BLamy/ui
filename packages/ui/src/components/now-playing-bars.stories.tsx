import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NowPlayingBars } from './now-playing-bars';
import { Button } from './button';
import { Caption, Panel } from '../stories/primitive-frame';

const meta: Meta<typeof NowPlayingBars> = {
  title: 'Atoms/NowPlayingBars',
  component: NowPlayingBars,
  args: { playing: true },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof NowPlayingBars>;

export const Default: Story = { render: (args) => <NowPlayingBars {...args} className="text-primary" /> };

const TRACKS = ['Golden Hour', 'Night Drive', 'Paper Planes', 'Low Tide'];

function TrackList() {
  const [current, setCurrent] = useState(1);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="flex flex-col">
      {TRACKS.map((t, i) => (
        <button key={t} type="button" onClick={() => (i === current ? setPlaying((p) => !p) : (setCurrent(i), setPlaying(true)))}
          className="bl-btn flex h-11 cursor-pointer items-center gap-3 border-0 border-b border-solid border-border bg-transparent px-1 text-left [font-family:inherit] text-[16px] text-foreground last:border-b-0">
          <span className="grid w-5 place-items-center text-[14px] text-muted-foreground tabular-nums">
            {i === current ? <NowPlayingBars playing={playing} className="text-primary" aria-label={playing ? 'Now playing' : 'Paused'} /> : i + 1}
          </span>
          <span className={i === current ? 'font-semibold text-primary' : undefined}>{t}</span>
        </button>
      ))}
    </div>
  );
}

/** Tap a row to play it; tap again to pause (the bars settle). */
export const InATrackList: Story = { render: () => <TrackList /> };

const variants = (
  <>
    <Caption>Sizes and bar counts</Caption>
    <div className="flex items-end gap-6 text-primary">
      <NowPlayingBars size={10} />
      <NowPlayingBars />
      <NowPlayingBars size={20} bars={5} />
      <NowPlayingBars size={32} bars={6} barWidth={4} gap={3} />
    </div>
    <Caption>Paused</Caption>
    <div className="flex items-end gap-6 text-muted-foreground">
      <NowPlayingBars playing={false} />
      <NowPlayingBars playing={false} size={20} bars={5} />
    </div>
  </>
);

export const Variants: Story = { render: () => variants };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => variants };

function Toggle() {
  const [playing, setPlaying] = useState(true);
  return (
    <div className="flex items-center gap-4">
      <NowPlayingBars playing={playing} size={24} className="text-primary" />
      <Button variant="secondary" size="sm" onPress={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</Button>
    </div>
  );
}
export const Interactive: Story = { render: () => <Toggle /> };

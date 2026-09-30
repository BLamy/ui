import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { ReplayPreview, formatReplayTime, type ReplayPreviewHandle } from './replay-preview';
import { replayDemoEvents } from '../demos/replay/replay-demo-events';
import { getReplayMarkers } from '@brett_lamy/docstream/replay';
import { Button } from './button';
import { Icon } from '../lib/icon';
import { Caption, Panel } from '../stories/primitive-frame';

const meta: Meta<typeof ReplayPreview> = {
  title: 'Molecules/ReplayPreview',
  component: ReplayPreview,
  args: { events: replayDemoEvents, initialTime: 6400, lazy: false },
  argTypes: {
    chrome: { control: 'inline-radio', options: ['browser', 'minimal', 'none'] },
    fit: { control: 'inline-radio', options: ['width', 'contain'] },
    events: { table: { disable: true } },
  },
  decorators: [(Story, { parameters }) => <Panel w={parameters.w ?? 760} dark={parameters.dark}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ReplayPreview>;

/** The browser frame, paused just before the failing checkout: the rail above the scrubber marks each click,
 *  the checkpoint, the failed request and the error. */
export const Default: Story = {};

export const Dark: Story = { parameters: { dark: true } };

/** At the failure: the error banner is on the page and the URL bar still reads the recorded address. */
export const AtError: Story = { args: { initialTime: 8400 } };

/** `chrome="minimal"`: the page and its controls in a card, no window. */
export const Minimal: Story = { args: { chrome: 'minimal' } };

/** No controls, no rail — a thumbnail that still shows the recorded pointer. */
export const Thumbnail: Story = {
  args: { chrome: 'none', controls: false, initialTime: 2300 },
  parameters: { w: 320 },
  render: (args) => <div className="overflow-hidden rounded-xl border border-border"><ReplayPreview {...args} /></div>,
};

/** Only the moments that matter: errors and failed requests. */
export const ErrorsOnly: Story = { args: { markerKinds: ['error', 'network'] } };

/** `fit="contain"` in a fixed-height box letterboxes the page. */
export const Contain: Story = {
  args: { fit: 'contain', chrome: 'minimal' },
  render: (args) => <div className="h-[300px]"><ReplayPreview {...args} /></div>,
};

/** A recording without a full DOM snapshot can't play: the page-shaped poster stays, with a note. (The same poster
 *  holds the frame's size while the player loads.) */
export const Unplayable: Story = {
  args: { events: replayDemoEvents.filter((e) => e.type !== 2) },
};

/** Driving the player from outside: a chronology whose steps seek the replay (`playerRef`, `onTimeUpdate`). */
export const Chronology: Story = {
  render: (args) => {
    const player = useRef<ReplayPreviewHandle>(null);
    const [time, setTime] = useState(args.initialTime ?? 0);
    const steps = getReplayMarkers(replayDemoEvents).filter((m) => m.kind !== 'click');
    return (
      <div className="flex flex-col gap-3">
        <ReplayPreview {...args} playerRef={player} onTimeUpdate={setTime} />
        <Caption>Chronology</Caption>
        <div className="flex flex-col gap-1">
          {steps.map((m) => (
            <Button
              key={m.id}
              variant="ghost"
              size="sm"
              className="h-auto justify-start gap-3 px-2 py-1.5 text-left font-medium data-[past=true]:text-muted-foreground"
              data-past={m.time <= time}
              onPress={() => player.current?.seek(m.time)}
            >
              <Icon name={m.kind === 'error' ? 'exclamation-circle' : m.kind === 'network' ? 'globe' : 'flag'} size={15} />
              <span className="w-10 text-[12px] text-muted-foreground tabular-nums">{formatReplayTime(m.time)}</span>
              <span className="truncate">{m.label}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  },
};

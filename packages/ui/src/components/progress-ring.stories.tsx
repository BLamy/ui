import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CountdownRing, ProgressRing, useCountdown } from './progress-ring';
import { Button } from './button';
import { Icon } from '../lib/icon';
import { Caption, Panel } from '../stories/primitive-frame';

const meta: Meta<typeof ProgressRing> = {
  title: 'Atoms/ProgressRing',
  component: ProgressRing,
  args: { value: 64, 'aria-label': 'Download' },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ProgressRing>;

export const Default: Story = { args: { size: 'lg', showValue: true } };

const row = 'flex items-center gap-5';

const all = (
  <>
    <Caption>Sizes</Caption>
    <div className={row}>
      <ProgressRing aria-label="Small" size="sm" value={40} />
      <ProgressRing aria-label="Medium" size="md" value={55} showValue />
      <ProgressRing aria-label="Large" size="lg" value={70} showValue />
      <ProgressRing aria-label="Extra large" size="xl" value={85} showValue />
    </div>
    <Caption>Tones</Caption>
    <div className={row}>
      <ProgressRing aria-label="Default" size="lg" value={30} />
      <ProgressRing aria-label="Success" size="lg" value={100} tone="success">
        <Icon name="check" size={18} sw={2.6} className="text-success" />
      </ProgressRing>
      <ProgressRing aria-label="Warning" size="lg" value={80} tone="warning" />
      <ProgressRing aria-label="Destructive" size="lg" value={95} tone="destructive" />
      <ProgressRing aria-label="Loading" size="lg" isIndeterminate />
    </div>
    <Caption>Countdown</Caption>
    <div className={row}>
      <CountdownRing remaining={24} />
      <CountdownRing remaining={12} size="lg" />
      <CountdownRing remaining={4} size="lg" />
      <CountdownRing remaining={9} duration={10} size="sm" />
    </div>
  </>
);

export const Variants: Story = { render: () => all };

export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => all };

/** A stop button in the middle, like a download in the App Store. */
export const WithContent: Story = {
  render: () => (
    <div className={row}>
      <ProgressRing aria-label="Downloading" size="lg" value={42}>
        <span className="block size-3 rounded-[2px] bg-primary" />
      </ProgressRing>
      <span className="text-[15px] text-muted-foreground">Downloading…</span>
    </div>
  ),
};

function Stepper() {
  const [v, setV] = useState(20);
  return (
    <div className="flex items-center gap-5">
      <ProgressRing aria-label="Progress" size="xl" value={v} showValue />
      <div className="flex gap-2">
        <Button variant="secondary" onPress={() => setV((x) => Math.max(0, x - 15))}>−15</Button>
        <Button variant="secondary" onPress={() => setV((x) => Math.min(100, x + 15))}>+15</Button>
      </div>
    </div>
  );
}

/** Press the buttons: the arc springs and the digits roll. */
export const Interactive: Story = { render: () => <Stepper /> };

function Live() {
  const [running, setRunning] = useState(false);
  const { remaining } = useCountdown(30, { running });
  return (
    <div className="flex items-center gap-4">
      <span className="text-[22px] font-medium tabular-nums">482 913</span>
      <CountdownRing remaining={remaining} />
      <Button variant="secondary" size="sm" onPress={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Start'}</Button>
    </div>
  );
}

/** `useCountdown` driving a verification-code ring (starts paused). */
export const LiveCountdown: Story = { render: () => <Live /> };

import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MotionConfig } from 'framer-motion';
import { Celebrate } from '@/components/ui/celebrate';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Celebrate> = {
  title: 'Atoms/Celebrate',
  component: Celebrate,
  args: { count: 22, spread: 100 },
  // `parameters.dark` switches the frame; a Dark story's own frame would nest inside this one.
  decorators: [(Story, { parameters }) => <Panel dark={parameters.dark}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Celebrate>;

function Demo(props: ComponentProps<typeof Celebrate>) {
  const [n, setN] = useState(0);
  return (
    <div className="grid justify-items-center gap-8 py-12">
      <Celebrate fire={n} {...props}>
        <span className={'grid size-16 place-items-center rounded-full text-white ' + (n ? 'bg-success' : 'bg-secondary-strong')}>
          <Icon name="check" size={32} sw={3} />
        </span>
      </Celebrate>
      <Button onClick={() => setN((x) => x + 1)}>Celebrate</Button>
    </div>
  );
}

/** Press "Celebrate": a ring pulses and confetti bursts from behind the badge, in the theme's colours. The play
    function fires one burst. */
export const Fire: Story = {
  render: (args) => <Demo {...args} />,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button')?.click();
  },
};

export const Dark: Story = {
  parameters: { dark: true },
  render: (args) => <Demo {...args} />,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button')?.click();
  },
};

/** With reduced motion only the ring plays, as a soft fade (forced here with framer's MotionConfig). */
export const ReducedMotion: Story = {
  render: (args) => (
    <MotionConfig reducedMotion="always">
      <Demo {...args} />
    </MotionConfig>
  ),
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button')?.click();
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { HapticsPlayground } from './haptics-playground';
import { NavigationStack } from '../components/navigation-stack';
import { Phone } from '../stories/frame';

const meta: Meta<typeof HapticsPlayground> = {
  title: 'Pages/Haptics Playground',
  component: HapticsPlayground,
};
export default meta;
type Story = StoryObj<typeof HapticsPlayground>;

export const InNavigationStack: Story = {
  render: () => (
    <Phone>
      <NavigationStack onPop={() => undefined} screens={[{
        key: 'play', title: 'Haptics Playground', grouped: true, maxW: 660,
        content: <HapticsPlayground />,
      }]} />
    </Phone>
  ),
};

export const Bare: Story = {
  render: () => (
    <Phone w={420} h={720}>
      <div className="tk-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--tk-bg2)', paddingTop: 12 }}>
        <HapticsPlayground />
      </div>
    </Phone>
  ),
};

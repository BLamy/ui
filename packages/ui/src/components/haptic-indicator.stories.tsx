import type { Meta, StoryObj } from '@storybook/react-vite';
import { HapticIndicator } from './haptic-indicator';
import { Button } from './button';
import { Haptics } from '../lib/haptics';
import { Phone } from '../stories/frame';

const meta: Meta<typeof HapticIndicator> = {
  title: 'Atoms/HapticIndicator',
  component: HapticIndicator,
};
export default meta;
type Story = StoryObj<typeof HapticIndicator>;

/** Fire any haptic — the pulse pill visualizes the event and reports the active engine. */
export const Interactive: Story = {
  render: () => (
    <Phone h={480}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, padding: 40 }}>
        <Button size="pill" variant="secondary" onPress={() => Haptics.impact('light')}>Impact · light</Button>
        <Button size="pill" variant="secondary" onPress={() => Haptics.impact('heavy')}>Impact · heavy</Button>
        <Button size="pill" variant="secondary" onPress={() => Haptics.selection()}>Selection tick</Button>
        <Button size="pill" variant="secondary" onPress={() => Haptics.notification('success')}>Notification · success</Button>
      </div>
      <HapticIndicator visible bottom={14} />
    </Phone>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { HapticIndicator } from './haptic-indicator';
import { PillButton } from './pill-button';
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
        <PillButton label="Impact · light" tone="soft" onPress={() => Haptics.impact('light')} />
        <PillButton label="Impact · heavy" tone="soft" onPress={() => Haptics.impact('heavy')} />
        <PillButton label="Selection tick" tone="soft" onPress={() => Haptics.selection()} />
        <PillButton label="Notification · success" tone="soft" onPress={() => Haptics.notification('success')} />
      </div>
      <HapticIndicator visible bottom={14} />
    </Phone>
  ),
};

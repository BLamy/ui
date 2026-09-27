import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeliveryTrackingDemo, type DeliveryTrackingDemoProps } from './delivery-tracking-demo';
import '../../styles.css';

interface Args extends DeliveryTrackingDemoProps {
  width: number;
  height: number;
}

const meta: Meta<Args> = {
  title: 'Pages/DeliveryTracking',
  render: ({ width, height, ...props }) => (
    <div style={{ width, height, overflow: 'hidden' }}>
      <DeliveryTrackingDemo {...props} />
    </div>
  ),
  args: { width: 430, height: 860, autoAdvance: true, peek: 344, appearance: 'sheet', tone: 'light', gutter: 0 },
  argTypes: {
    stage: { control: { type: 'range', min: 0, max: 3, step: 1 } },
    appearance: { control: 'radio', options: ['glass', 'sheet'] },
    tone: { control: 'radio', options: ['auto', 'dark', 'light'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'A DoorDash-style order tracker composed from the same primitives as the map chat: a light TileMap under an opaque, edge-docked FloatingSheet. The stepper, instruction card, disclosure, and carousels are plain siblings in the sheet body. Tiles load from Esri, so this needs network.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Preparing: Story = { args: { stage: 1, autoAdvance: false } };
export const AutoAdvancing: Story = {};
export const GlassVariant: Story = { args: { stage: 2, autoAdvance: false, appearance: 'glass', tone: 'light', gutter: 16 } };

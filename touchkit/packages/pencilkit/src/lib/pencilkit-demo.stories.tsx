import type { Meta, StoryObj } from '@storybook/react-vite';
import { PencilKitDemo } from './pencilkit-demo';
import { demoStrokes } from '../demos/demo-strokes';

const meta: Meta<typeof PencilKitDemo> = {
  title: 'Pages/PencilKit',
  component: PencilKitDemo,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 834, height: 640, overflow: 'hidden', borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof PencilKitDemo>;

export const Light: Story = { args: { dark: false } };
export const Dark: Story = { args: { dark: true } };
export const TintedPink: Story = { args: { dark: false, tint: '#FF375F' } };

/** Pre-seeded strokes so tools, eraser, undo/redo and clear are demonstrable immediately. */
export const Seeded: Story = {
  args: { dark: false, defaultStrokes: demoStrokes() },
  parameters: {
    docs: {
      description: {
        story:
          'Starts with one stroke per tool (pen / marker / pencil). Switch to the eraser and drag across a stroke to delete it; undo/redo/clear operate on the seeded history.',
      },
    },
  },
};

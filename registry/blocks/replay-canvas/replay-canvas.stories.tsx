import type { Meta, StoryObj } from '@storybook/react-vite';
import ReplayCanvas, { type ReplayCanvasProps } from './page';
import { SAMPLE_RECORDINGS } from './recordings';

interface Args extends ReplayCanvasProps {
  width: number;
  height: number;
}

const meta: Meta<Args> = {
  title: 'Pages/ReplayCanvas',
  render: ({ width, height, ...props }) => (
    <div style={{ width, height, overflow: 'hidden' }}>
      <ReplayCanvas {...props} />
    </div>
  ),
  args: { width: 1400, height: 880 },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'An app taken apart from its rrweb recordings: pages, the layers opened over them and their states as frames on a canvas, with segues from each click to what it opened. Every recording folds into the same map.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<Meta<Args>>;

/** All four Tandem sessions folded into one map. */
export const FourRecordings: Story = {};

/** A single session: what one recording shows on its own. */
export const OneRecording: Story = { args: { recordings: SAMPLE_RECORDINGS.slice(0, 1) } };

/** Dark chrome. */
export const Dark: Story = { args: { appearance: 'dark' } };

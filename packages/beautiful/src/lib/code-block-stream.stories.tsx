import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeBlockStream } from './code-block-stream';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof CodeBlockStream> = {
  title: 'Organisms/CodeBlockStream',
  component: CodeBlockStream,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof CodeBlockStream>;

export const Default: Story = {};
export const CustomFile: Story = {
  args: {
    filename: 'reorder.py',
    language: 'PYTHON',
    code: 'def reorder(skus):\n    risky = [s for s in skus if s.risk > 0.7]\n    return sorted(risky, key=lambda s: -s.risk)',
  },
};

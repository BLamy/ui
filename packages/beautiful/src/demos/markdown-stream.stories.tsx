import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownStreamDemo } from './markdown-stream';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof MarkdownStreamDemo> = {
  title: 'Molecules/MarkdownStream',
  component: MarkdownStreamDemo,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof MarkdownStreamDemo>;

export const Default: Story = {};
export const CustomMarkdown: Story = {
  args: {
    markdown:
      'Vanilla holds steady [^1] while sorbet demand doubles every heatwave — pre-batch on Fridays with @dana on #ops.\n\n[^1]: https://scoopdata.io/vanilla "ScoopData"',
    sourcesLabel: '1 source',
  },
};

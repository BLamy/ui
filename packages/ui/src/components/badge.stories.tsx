import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  args: { children: 'Badge', variant: 'default' },
  argTypes: { variant: { control: 'inline-radio', options: ['default', 'secondary', 'tinted', 'outline', 'destructive', 'success'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

const all = (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>New</Badge>
    <Badge variant="secondary">Draft</Badge>
    <Badge variant="tinted">Beta</Badge>
    <Badge variant="outline">v2.4</Badge>
    <Badge variant="destructive">3 failed</Badge>
    <Badge variant="success">Live</Badge>
    <Badge className="min-w-[22px] px-1.5 tabular-nums">12</Badge>
  </div>
);

export const Variants: Story = { render: () => all };

export const Dark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: () => all,
};

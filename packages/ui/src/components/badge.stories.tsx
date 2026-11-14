import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icon } from '@/lib/icon';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  args: { children: 'Badge', variant: 'default', size: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'secondary', 'tinted', 'outline', 'destructive', 'success', 'warning'] },
    size: { control: 'inline-radio', options: ['sm', 'default'] },
  },
  // `parameters.dark` switches the frame; a Dark story's own frame would nest inside this one.
  decorators: [(Story, { parameters }) => <Panel dark={parameters.dark}><Story /></Panel>],
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
    <Badge variant="warning">Expiring</Badge>
    <Badge>12</Badge>
    <Badge>3</Badge>
  </div>
);

export const Variants: Story = { render: () => all };

export const Dark: Story = {
  parameters: { dark: true },
  render: () => all,
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge size="sm">3</Badge>
      <Badge size="sm" variant="tinted">12</Badge>
      <Badge size="sm" variant="secondary">128</Badge>
      <Badge>3</Badge>
      <Badge variant="tinted">12</Badge>
      <Badge variant="secondary">128</Badge>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success"><Icon name="check" />Verified</Badge>
      <Badge variant="warning"><Icon name="warning" />Expiring</Badge>
      <Badge variant="outline"><Icon name="lock" />Private</Badge>
    </div>
  ),
};

/** A count at the end of a row: `size="sm"`, named for screen readers, since "12" alone says nothing. */
export const InRow: Story = {
  render: () => (
    <Card>
      {[['Inbox', 12], ['Drafts', 3], ['Flagged', 0]].map(([label, n], i) => (
        <div key={label} className={`flex h-row items-center justify-between px-4 text-body text-foreground ${i ? 'shadow-hairline-t' : ''}`}>
          {label}
          {n ? <Badge size="sm" variant="tinted" aria-label={`${n} unread`}>{n}</Badge> : null}
        </div>
      ))}
    </Card>
  ),
};

/** `render`: a link that looks like a badge. */
export const AsLink: Story = {
  render: () => <Badge variant="destructive" render={<a href="#failures" />}>View 3 failures</Badge>,
};

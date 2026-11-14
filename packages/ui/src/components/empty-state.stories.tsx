import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/lib/icon';
import { Panel, Screen } from '../stories/primitive-frame';

const meta: Meta<typeof EmptyState> = {
  title: 'Molecules/EmptyState',
  component: EmptyState,
  args: {
    size: 'default',
    title: 'No messages',
    description: 'Messages you receive will appear here.',
  },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] } },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

const light: Decorator[] = [(Story) => <Panel><Story /></Panel>];

export const Default: Story = {
  decorators: light,
  render: (args) => (
    <Card className="h-64">
      <EmptyState icon={<Icon name="tray" />} {...args} />
    </Card>
  ),
};

export const WithAction: Story = {
  decorators: light,
  render: () => (
    <Card className="h-72">
      <EmptyState
        icon={<Icon name="doc" />}
        title="No documents"
        description="Create a document or drop a file here."
        action={<><Button size="sm">New document</Button><Button size="sm" variant="secondary">Import…</Button></>}
      />
    </Card>
  ),
};

/** `sm`: inside a list, table, tree or popup. What the data components show by default. */
export const Small: Story = {
  decorators: light,
  render: () => (
    <div className="grid gap-4">
      <Card><EmptyState size="sm" title="No rows" /></Card>
      <Card><EmptyState size="sm" icon={<Icon name="magnifyingglass" />} title="No matches" description="Try a different search." /></Card>
    </div>
  ),
};

/** `lg`: a whole page or a phone screen. */
export const Large: Story = {
  decorators: [(Story) => <Screen h={720}><Story /></Screen>],
  render: () => (
    <EmptyState
      size="lg"
      icon={<Icon name="star" />}
      title="No favorites yet"
      description="Tap the star on any item to keep it here."
      action={<Button>Browse items</Button>}
      className="min-h-[560px]"
    />
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: () => (
    <div className="grid gap-4">
      <Card className="h-64">
        <EmptyState icon={<Icon name="tray" />} title="No messages" description="Messages you receive will appear here." action={<Button size="sm">Compose</Button>} />
      </Card>
      <Card><EmptyState size="sm" icon={<Icon name="magnifyingglass" />} title="No matches" description="Try a different search." /></Card>
    </div>
  ),
};

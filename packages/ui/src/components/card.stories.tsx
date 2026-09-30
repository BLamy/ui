import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Card> = {
  title: 'Molecules/Card',
  component: Card,
  args: { variant: 'default' },
  argTypes: { variant: { control: 'inline-radio', options: ['default', 'elevated', 'outline'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Card>;

const body = (
  <>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>Storage</CardTitle>
        <Badge variant="tinted">Pro</Badge>
      </div>
      <CardDescription>48.2 GB of 200 GB used</CardDescription>
    </CardHeader>
    <CardContent><Progress value={24} aria-label="Storage used" /></CardContent>
    <CardFooter>
      <Button size="sm" variant="secondary">Manage</Button>
      <Button size="sm">Upgrade</Button>
    </CardFooter>
  </>
);

export const Default: Story = { render: (args) => <Card {...args}>{body}</Card> };

export const Variants: Story = {
  render: () => (
    <>
      <Card variant="default">{body}</Card>
      <Card variant="elevated">{body}</Card>
      <Card variant="outline">{body}</Card>
    </>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: () => (<><Card>{body}</Card><Card variant="outline">{body}</Card></>),
};

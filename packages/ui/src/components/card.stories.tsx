import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/lib/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Card> = {
  title: 'Molecules/Card',
  component: Card,
  args: { variant: 'default' },
  argTypes: { variant: { control: 'inline-radio', options: ['default', 'elevated', 'outline'] } },
  // `parameters.dark` switches the frame; a Dark story's own frame would nest inside this one.
  decorators: [(Story, { parameters }) => <Panel dark={parameters.dark}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Card>;

const body = (
  <>
    <CardHeader>
      <CardTitle>Storage</CardTitle>
      <CardDescription>48.2 GB of 200 GB used</CardDescription>
      <CardAction><Badge variant="tinted">Pro</Badge></CardAction>
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
  parameters: { dark: true },
  render: () => (<><Card>{body}</Card><Card variant="elevated">{body}</Card><Card variant="outline">{body}</Card></>),
};

/** `render={<a href />}`: the whole card is one link, named by its title. Nothing inside it is interactive. */
export const AsLink: Story = {
  render: () => (
    <Card variant="elevated" render={<a href="#release" />} className="no-underline transition-transform active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <CardHeader>
        <CardTitle render={<h2 />}>What's new in 6.0</CardTitle>
        <CardDescription>Built on UI SDK, with a responsive Dialog and one Tabs for every bar.</CardDescription>
        <CardAction><Icon name="chevron-right" size={16} className="text-tertiary-foreground" /></CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground">Read the release notes</CardContent>
    </Card>
  ),
};

/** Avatars on a card ring themselves in the card's colour. */
export const WithAvatars: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Design review</CardTitle>
        <CardDescription>Thursday, 10:00</CardDescription>
        <CardAction className="flex">
          {['Ada Lovelace', 'Miles Davis', 'Noor Haddad'].map((n) => <Avatar key={n} name={n} size={28} status="online" />)}
        </CardAction>
      </CardHeader>
      <CardContent>Agenda: the new sidebar, the toolbar, and dark mode.</CardContent>
    </Card>
  ),
};

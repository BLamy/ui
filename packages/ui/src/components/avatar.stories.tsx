import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import { AvatarGroup } from '@/components/ui/avatar-group';
import { Card } from '@/components/ui/card';
import { HoverCardHeader } from '@/components/ui/hover-card';
import { Icon } from '@/lib/icon';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
  // `parameters.dark` switches the frame; a Dark story's own frame would nest inside this one.
  decorators: [(Story, { parameters }) => <Pad dark={parameters.dark}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: { name: 'Amelia Adler', size: 40 },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {[24, 34, 40, 56, 92].map((s) => <Avatar key={s} name="Wei Chen" size={s} />)}
    </div>
  ),
};

export const Palette: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {[['Amelia', 'Adler'], ['Wei', 'Chen'], ['Anya', 'Kowalski'], ['Hana', 'Sato'], ['Chidi', 'Okafor'], ['June', 'Calloway'], ['Ezra', 'Rhodes'], ['Lin', 'Yang']].map(([f, l]) => (
        <Avatar key={f + l} name={`${f} ${l}`} />
      ))}
    </div>
  ),
};

export const FromAName: Story = {
  args: { name: 'Ada Lovelace', size: 40 },
};

export const Accent: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name="Ada" tint="#0A84FF" />
      <Avatar name="Miles" tint="#BF5AF2" />
      <Avatar name="Noor" tint="#FF9F0A" />
      <Avatar name="Theo" tint="#32D74B" />
    </div>
  ),
};

export const Presence: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {(['online', 'idle', 'dnd', 'offline'] as const).map((status) => (
        <Avatar key={status} name="Noor" tint="#FF9F0A" status={status} />
      ))}
    </div>
  ),
};

export const Bot: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name="Stitch" tint="#5E5CE6" shape="square" icon={<Icon name="sparkle" size={20} sw={2.2} />} />
      <Avatar name="Stitch" tint="#5E5CE6" shape="square" size={24} icon={<Icon name="sparkle" size={12} sw={2.2} />} status="online" />
    </div>
  ),
};

export const Image: Story = {
  args: { name: 'Ada Lovelace', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="%230A84FF"/><circle cx="4" cy="3" r="1.6" fill="white"/><path d="M1.2 8a2.8 2.8 0 0 1 5.6 0z" fill="white"/></svg>', size: 56 },
};

const PEOPLE = ['Ada', 'Miles', 'Noor', 'Theo', 'Hana', 'Chidi', 'June', 'Ezra', 'Lin', 'Amelia', 'Wei', 'Anya', 'Sam', 'Priya', 'Omar'];

export const Group: StoryObj<typeof AvatarGroup> = {
  render: (args) => (
    <AvatarGroup {...args}>
      {PEOPLE.slice(0, 4).map((name) => <Avatar key={name} name={name} />)}
    </AvatarGroup>
  ),
};

/** Past `max` (5 by default) the rest fold into a `+N` bubble; with `menu`, the menu still lists everyone. */
export const GroupOverflow: StoryObj<typeof AvatarGroup> = {
  args: { max: 5, menu: true },
  render: (args) => (
    <AvatarGroup {...args}>
      {PEOPLE.map((name) => <Avatar key={name} name={name} />)}
    </AvatarGroup>
  ),
};

/** `menu`: the stack is one button that opens a menu of everyone. */
export const GroupMenu: StoryObj<typeof AvatarGroup> = {
  render: () => (
    <AvatarGroup menu size={24} max={3} aria-label="Reviewers">
      {PEOPLE.slice(0, 6).map((name) => <Avatar key={name} name={name} />)}
    </AvatarGroup>
  ),
};

/** `card`: a hover card about the person, opened by resting the pointer on the avatar or focusing it. */
export const HoverCard: Story = {
  render: () => (
    <Avatar
      name="Ada Lovelace"
      status="online"
      card={<HoverCardHeader icon={<Avatar name="Ada Lovelace" size={44} />} title="Ada Lovelace" description="Wrote the first program" />}
    />
  ),
};

/** On a Card the rings and the presence dot's border take the card's colour (`--avatar-ring`). */
export const OnACard: Story = {
  render: () => (
    <Card className="flex-row items-center gap-3 p-4">
      <AvatarGroup aria-label="Team">
        {PEOPLE.slice(0, 4).map((name) => <Avatar key={name} name={name} />)}
      </AvatarGroup>
      <Avatar name="Noor" status="online" />
    </Card>
  ),
};

const darkSet = (
  <div className="grid gap-4">
    <div className="flex flex-wrap gap-2.5">
      {['Amelia Adler', 'Wei Chen', 'Anya Kowalski', 'Hana Sato', 'Chidi Okafor', 'June Calloway', 'Ezra Rhodes', 'Lin Yang', 'Aiko Kim', 'Jae Cho'].map((n) => <Avatar key={n} name={n} />)}
    </div>
    <div className="flex items-center gap-3.5">
      {(['online', 'idle', 'dnd', 'offline'] as const).map((status) => <Avatar key={status} name="Noor Haddad" status={status} />)}
    </div>
    <AvatarGroup max={4}>{PEOPLE.slice(0, 7).map((name) => <Avatar key={name} name={name} />)}</AvatarGroup>
  </div>
);

export const Dark: Story = {
  parameters: { dark: true },
  render: () => darkSet,
};

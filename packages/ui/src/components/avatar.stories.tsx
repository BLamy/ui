import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { Icon } from '@/lib/icon';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: { c: { f: 'Amelia', l: 'Adler' }, size: 40 },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {[24, 34, 40, 56, 92].map((s) => <Avatar key={s} c={{ f: 'Wei', l: 'Chen' }} size={s} />)}
    </div>
  ),
};

export const Palette: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {[['Amelia', 'Adler'], ['Wei', 'Chen'], ['Anya', 'Kowalski'], ['Hana', 'Sato'], ['Chidi', 'Okafor'], ['June', 'Calloway'], ['Ezra', 'Rhodes'], ['Lin', 'Yang']].map(([f, l]) => (
        <Avatar key={f + l} c={{ f, l }} />
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
      <Avatar name="Ada" color="#0A84FF" />
      <Avatar name="Miles" color="#BF5AF2" />
      <Avatar name="Noor" color="#FF9F0A" />
      <Avatar name="Theo" color="#32D74B" />
    </div>
  ),
};

export const Presence: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {(['online', 'idle', 'dnd', 'offline'] as const).map((status) => (
        <Avatar key={status} name="Noor" color="#FF9F0A" status={status} />
      ))}
    </div>
  ),
};

export const Bot: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name="Stitch" color="#5E5CE6" shape="square" icon={<Icon name="sparkle" size={20} sw={2.2} />} />
      <Avatar name="Stitch" color="#5E5CE6" shape="square" size={24} icon={<Icon name="sparkle" size={12} sw={2.2} />} status="online" />
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

/** Past `max` (5 by default) the rest fold into a `+N` bubble; the menu still lists everyone. */
export const GroupOverflow: StoryObj<typeof AvatarGroup> = {
  args: { max: 5 },
  render: (args) => (
    <AvatarGroup {...args}>
      {PEOPLE.map((name) => <Avatar key={name} name={name} />)}
    </AvatarGroup>
  ),
};

export const GroupPlain: StoryObj<typeof AvatarGroup> = {
  render: () => (
    <AvatarGroup menu={false} size={24} max={3} label="Reviewers">
      {PEOPLE.slice(0, 6).map((name) => <Avatar key={name} name={name} />)}
    </AvatarGroup>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './avatar';
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

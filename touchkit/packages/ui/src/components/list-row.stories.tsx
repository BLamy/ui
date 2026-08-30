import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './avatar';
import { Icon } from '../lib/icon';
import { ListRow } from './list';
import { Switch } from './switch';
import { Pad } from '../stories/frame';

const meta: Meta<typeof ListRow> = {
  title: 'Molecules/ListRow',
  component: ListRow,
  decorators: [(Story) => (
    <Pad w={390}>
      <div style={{ borderRadius: 12, overflow: 'hidden' }}><Story /></div>
    </Pad>
  )],
};
export default meta;
type Story = StoryObj<typeof ListRow>;

export const Basic: Story = {
  args: { title: 'Ringtone', divider: false },
};

export const SubtitleAndLeading: Story = {
  render: () => (
    <ListRow
      title={<span>Wei <span style={{ fontWeight: 600 }}>Chen</span></span>}
      subtitle="iOS Engineer · Parallel"
      leading={<Avatar c={{ f: 'Wei', l: 'Chen' }} />}
      trailing={<Icon name="starF" size={13} style={{ color: '#FF9F0A' }} />}
      divider={false}
      onPress={() => undefined}
    />
  ),
};

export const Chevron: Story = {
  args: { title: 'Share Contact', accessory: 'chevron', onPress: () => undefined, divider: false },
};

export const Check: Story = {
  render: () => {
    const [v, setV] = useState('Reflection');
    return (
      <>
        {['Reflection', 'Chimes', 'Circuit'].map((r, i) => (
          <ListRow key={r} title={r} accessory="check" checked={v === r} rowRole="option"
            onPress={() => setV(r)} divider={i < 2} />
        ))}
      </>
    );
  },
};

export const SwipeToDelete: Story = {
  render: () => {
    const [gone, setGone] = useState<Set<string>>(new Set());
    const people = [['Amelia', 'Adler'], ['Wei', 'Chen'], ['Anya', 'Kowalski']].filter(([f]) => !gone.has(f));
    return (
      <>
        {people.map(([f, l], i) => (
          <ListRow key={f} title={f + ' ' + l} leading={<Avatar c={{ f, l }} size={34} />}
            onDelete={() => setGone((g) => new Set([...g, f]))}
            onPress={() => undefined}
            divider={i < people.length - 1} />
        ))}
        <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--tk-label2)', background: 'var(--tk-card)' }}>
          Swipe a row left to reveal Delete; past 55% width it commits with a haptic.
        </div>
      </>
    );
  },
};

export const EditMode: Story = {
  render: () => {
    const [edit, setEdit] = useState(true);
    const [picked, setPicked] = useState<Set<string>>(new Set(['Wei']));
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px', background: 'var(--tk-card)' }}>
          <Switch checked={edit} onChange={setEdit} aria-label="Edit mode" />
        </div>
        {[['Amelia', 'Adler'], ['Wei', 'Chen'], ['Anya', 'Kowalski']].map(([f, l], i) => (
          <ListRow key={f} title={f + ' ' + l} leading={<Avatar c={{ f, l }} size={34} />}
            edit={edit} checked={picked.has(f)}
            onPress={() => setPicked((p) => { const n = new Set(p); n.has(f) ? n.delete(f) : n.add(f); return n; })}
            divider={i < 2} />
        ))}
      </>
    );
  },
};

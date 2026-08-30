import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EditBar } from './edit-bar';
import { Phone } from '../stories/frame';

const meta: Meta<typeof EditBar> = {
  title: 'Molecules/EditBar',
  component: EditBar,
  decorators: [(Story) => <Phone w={390} h={220}><Story /></Phone>],
};
export default meta;
type Story = StoryObj<typeof EditBar>;

export const Empty: Story = { args: { count: 0 } };
export const WithSelection: Story = { args: { count: 3, allFav: false } };
export const AllFavorited: Story = { args: { count: 2, allFav: true } };

export const Interactive: Story = {
  render: () => {
    const [count, setCount] = useState(2);
    const [allFav, setAllFav] = useState(false);
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14, color: 'var(--tk-label2)' }}>
          <button onClick={() => setCount((c) => (c + 1) % 5)} style={{ fontFamily: 'inherit', fontSize: 14, padding: '6px 14px', borderRadius: 9, border: '1px solid var(--tk-sep)', background: 'var(--tk-card)', color: 'var(--tk-label)', cursor: 'pointer' }}>
            selected: {count} (click to cycle)
          </button>
        </div>
        <EditBar count={count} allFav={allFav} onFav={() => setAllFav((v) => !v)} onDelete={() => setCount(0)} />
      </>
    );
  },
};

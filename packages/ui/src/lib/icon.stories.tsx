import type { Meta, StoryObj } from '@storybook/react-vite';
import { IC, Icon } from './icon';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Icon> = {
  title: 'Atoms/Icon',
  component: Icon,
  decorators: [(Story) => <Pad w={420}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Icon>;

export const Gallery: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
      {Object.keys(IC).map((name) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--tk-label)' }}>
          <Icon name={name} size={24} />
          <span style={{ fontSize: 10.5, fontFamily: 'ui-monospace,Menlo,monospace', color: 'var(--tk-label2)' }}>{name}</span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--tk-tint)' }}>
      {[14, 18, 22, 28, 36, 48].map((s) => <Icon key={s} name="star" size={s} />)}
    </div>
  ),
};

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './switch';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Switch> = {
  title: 'Atoms/Switch',
  component: Switch,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Switch>;

function Demo({ initial }: { initial?: boolean }) {
  const [on, setOn] = useState(!!initial);
  return <Switch checked={on} onChange={setOn} aria-label="Demo switch" />;
}

export const Off: Story = { render: () => <Demo /> };
export const On: Story = { render: () => <Demo initial /> };

export const InRow: Story = {
  render: () => {
    const [a, setA] = useState(true);
    const [b, setB] = useState(false);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[['Haptics', a, setA] as const, ['Dark Mode', b, setB] as const].map(([label, v, set]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 17 }}>
            <span>{label}</span>
            <Switch checked={v} onChange={set} aria-label={label} />
          </div>
        ))}
      </div>
    );
  },
};

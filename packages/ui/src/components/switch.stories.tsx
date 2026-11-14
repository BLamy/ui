import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  return <Switch checked={on} onCheckedChange={setOn} aria-label="Demo switch" />;
}

export const Off: Story = { render: () => <Demo /> };
export const On: Story = { render: () => <Demo initial /> };

export const InRow: Story = {
  render: () => {
    const [a, setA] = useState(true);
    const [b, setB] = useState(false);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[['Sounds', a, setA] as const, ['Dark Mode', b, setB] as const].map(([label, v, set]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 17 }}>
            <span>{label}</span>
            <Switch checked={v} onCheckedChange={set} aria-label={label} />
          </div>
        ))}
      </div>
    );
  },
};

/** Wrapped in a Label with its text, the whole line turns it on and off; `disabled` dims it. */
export const Labelled: Story = {
  render: () => (
    <div className="flex flex-col gap-3.5">
      <Label variant="control" className="justify-between">Airplane mode<Switch /></Label>
      <Label variant="control" className="justify-between">Security alerts<Switch defaultChecked disabled /></Label>
    </div>
  ),
};

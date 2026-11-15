import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Switch> = {
  title: 'Atoms/Switch',
  component: Switch,
  args: { size: 'default', disabled: false },
  argTypes: { size: { control: 'inline-radio', options: ['default', 'sm'] } },
  decorators: [(Story, { parameters }) => <Pad appearance={parameters.dark ? 'dark' : 'light'}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Switch>;

function Demo({ initial, ...props }: { initial?: boolean } & React.ComponentProps<typeof Switch>) {
  const [on, setOn] = useState(!!initial);
  return <Switch checked={on} onCheckedChange={setOn} aria-label="Wi-Fi" {...props} />;
}

export const Default: Story = { render: (args) => <Demo initial {...args} /> };
export const Off: Story = { render: () => <Demo /> };
export const On: Story = { render: () => <Demo initial /> };

export const InRow: Story = {
  render: () => {
    const [a, setA] = useState(true);
    const [b, setB] = useState(false);
    return (
      <div className="flex flex-col gap-3.5">
        {[['Sounds', a, setA] as const, ['Dark Mode', b, setB] as const].map(([label, v, set]) => (
          <div key={label} className="flex items-center justify-between text-body">
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

/** `default` is iOS's 51×31 switch; `sm` (38×22) is the macOS and inspector size. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3.5">
      <Label variant="control" className="justify-between">Bluetooth<Switch defaultChecked /></Label>
      <Label variant="control" className="justify-between text-subhead">Show in menu bar<Switch size="sm" defaultChecked /></Label>
      <Label variant="control" className="justify-between text-subhead">Wake for network access<Switch size="sm" /></Label>
    </div>
  ),
};

const states = (
  <div className="flex flex-col gap-3.5">
    <Label variant="control" className="justify-between">Disabled off<Switch disabled /></Label>
    <Label variant="control" className="justify-between">Disabled on<Switch disabled defaultChecked /></Label>
    <Label variant="control" className="justify-between">Read-only on<Switch readOnly defaultChecked /></Label>
    <Label variant="control" className="justify-between text-subhead">Small, disabled<Switch size="sm" disabled defaultChecked /></Label>
  </div>
);

export const States: Story = { render: () => states };
export const Dark: Story = { parameters: { dark: true }, render: () => <div className="flex flex-col gap-5"><Demo initial /><Demo />{states}</div> };

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox, CheckboxGroup } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
  args: { shape: 'circle' },
  argTypes: { shape: { control: 'inline-radio', options: ['circle', 'square'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: (args) => <Label variant="control"><Checkbox {...args} />Remember me</Label>,
};

const states = (shape: 'circle' | 'square') => (
  <div className="flex flex-col gap-3">
    <Label variant="control"><Checkbox shape={shape} />Unchecked</Label>
    <Label variant="control"><Checkbox shape={shape} defaultChecked />Checked</Label>
    <Label variant="control"><Checkbox shape={shape} defaultChecked="indeterminate" />Indeterminate</Label>
    <Label variant="control"><Checkbox shape={shape} disabled defaultChecked />Disabled</Label>
    <Label variant="control"><Checkbox shape={shape} aria-invalid />Invalid</Label>
  </div>
);

export const Circle: Story = { render: () => states('circle') };
export const Square: Story = { render: () => states('square') };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => states('circle') };

export const Group: Story = {
  render: () => (
    <CheckboxGroup id="notify" defaultValue={['mentions', 'dms']}>
      <Label htmlFor="notify" variant="field">Notify me about</Label>
      <Card className="gap-0 px-4">
        {[['all', 'All new messages'], ['mentions', 'Mentions'], ['dms', 'Direct messages'], ['threads', 'Thread replies']].map(([v, t], i) => (
          <Label key={v} variant="control" className={i ? 'py-[11px] shadow-[inset_0_1px_0_var(--border)]' : 'py-[11px]'}><Checkbox value={v} />{t}</Label>
        ))}
      </Card>
    </CheckboxGroup>
  ),
};

/** A `parent` checkbox checks or clears the group, and is mixed while only some are checked. */
export const SelectAll: Story = {
  render: () => (
    <CheckboxGroup aria-label="Channels" allValues={['email', 'push', 'sms']} defaultValue={['email']}>
      <Label variant="control" className="font-semibold"><Checkbox parent />All channels</Label>
      <Label variant="control" className="pl-[34px]"><Checkbox value="email" />Email</Label>
      <Label variant="control" className="pl-[34px]"><Checkbox value="push" />Push notifications</Label>
      <Label variant="control" className="pl-[34px]"><Checkbox value="sms" />SMS</Label>
    </CheckboxGroup>
  ),
};

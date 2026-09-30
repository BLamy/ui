import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox, CheckboxGroup } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
  args: { children: 'Remember me', shape: 'circle' },
  argTypes: { shape: { control: 'inline-radio', options: ['circle', 'square'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};

const states = (shape: 'circle' | 'square') => (
  <div className="flex flex-col gap-3">
    <Checkbox shape={shape}>Unchecked</Checkbox>
    <Checkbox shape={shape} defaultSelected>Checked</Checkbox>
    <Checkbox shape={shape} isIndeterminate>Indeterminate</Checkbox>
    <Checkbox shape={shape} isDisabled defaultSelected>Disabled</Checkbox>
    <Checkbox shape={shape} isInvalid>Invalid</Checkbox>
  </div>
);

export const Circle: Story = { render: () => states('circle') };
export const Square: Story = { render: () => states('square') };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => states('circle') };

export const Group: Story = {
  render: () => (
    <CheckboxGroup defaultValue={['mentions', 'dms']}>
      <Label variant="field">Notify me about</Label>
      <Card className="gap-0 px-4">
        {[['all', 'All new messages'], ['mentions', 'Mentions'], ['dms', 'Direct messages'], ['threads', 'Thread replies']].map(([v, t], i) => (
          <Checkbox key={v} value={v} className={i ? 'py-[11px] shadow-[inset_0_1px_0_var(--border)]' : 'py-[11px]'}>{t}</Checkbox>
        ))}
      </Card>
    </CheckboxGroup>
  ),
};

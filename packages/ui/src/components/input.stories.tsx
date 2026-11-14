import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  args: { placeholder: 'Name', size: 'default' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { 'aria-label': 'Name' } };

const states = (
  <>
    <Input aria-label="Empty" placeholder="Placeholder" />
    <Input aria-label="Filled" defaultValue="Brett Lamy" />
    <Input aria-label="Small" size="sm" placeholder="Small" />
    <Input aria-label="Large" size="lg" placeholder="Large" />
    <Input aria-label="Invalid" aria-invalid defaultValue="br" />
    <Input aria-label="Read-only" readOnly defaultValue="RPLY-2041-XK" />
    <Input aria-label="Disabled" disabled defaultValue="Disabled" />
    <Textarea aria-label="Notes" placeholder="Notes" />
  </>
);

export const States: Story = { render: () => states };

/** Focus swaps the fill for the inset primary ring. */
export const Focused: Story = { args: { 'aria-label': 'Name', autoFocus: true, defaultValue: 'Brett Lamy' } };

/** The three heights beside the buttons they line up with: a 32px field with a small button, a 44px field with a large one. */
export const BesideAButton: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2"><Input size="sm" aria-label="Tag" placeholder="Tag" /><Button size="sm">Add</Button></div>
      <div className="flex gap-2"><Input aria-label="Email" placeholder="you@example.com" /><Button size="lg">Invite</Button></div>
    </div>
  ),
};
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => states };
export const TextareaField: Story = { render: () => <Textarea aria-label="Message" defaultValue={'Hey! Are we still on for Friday?\nI can bring the slides.'} /> };

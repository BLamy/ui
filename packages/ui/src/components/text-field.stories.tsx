import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField, FieldDescription, FieldError } from '@/components/ui/text-field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof TextField> = {
  title: 'Molecules/TextField',
  component: TextField,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof TextField>;

const fields = (
  <>
    <TextField defaultValue="brett@example.com" type="email">
      <Label variant="field">Email</Label>
      <Input />
      <FieldDescription>Used for sign-in and receipts.</FieldDescription>
    </TextField>
    <TextField isInvalid defaultValue="br">
      <Label variant="field">Username</Label>
      <Input />
      <FieldError>Usernames need at least 3 characters.</FieldError>
    </TextField>
    <TextField>
      <Label variant="field">Bio</Label>
      <Textarea placeholder="A few words about you" size="sm" />
    </TextField>
  </>
);

export const Default: Story = {
  render: () => (
    <TextField>
      <Label variant="field">Display name</Label>
      <Input placeholder="Jane Appleseed" />
    </TextField>
  ),
};
export const WithHelpAndError: Story = { render: () => fields };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => fields };

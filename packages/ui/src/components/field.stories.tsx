import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Field> = {
  title: 'Molecules/Field',
  component: Field,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Field>;

const fields = (
  <>
    <Field name="email">
      <FieldLabel variant="field">Email</FieldLabel>
      <Input type="email" defaultValue="brett@example.com" />
      <FieldDescription>Used for sign-in and receipts.</FieldDescription>
    </Field>
    <Field name="username" invalid>
      <FieldLabel variant="field">Username</FieldLabel>
      <Input defaultValue="br" />
      <FieldError match>Usernames need at least 3 characters.</FieldError>
    </Field>
    <Field name="bio">
      <FieldLabel variant="field">Bio</FieldLabel>
      <Textarea placeholder="A few words about you" size="sm" />
    </Field>
  </>
);

export const Default: Story = {
  render: (args) => (
    <Field {...args}>
      <FieldLabel variant="field">Display name</FieldLabel>
      <Input placeholder="Jane Appleseed" />
    </Field>
  ),
};
export const WithHelpAndError: Story = { render: () => fields };
export const Disabled: Story = {
  render: () => (
    <Field disabled>
      <FieldLabel variant="field">Email</FieldLabel>
      <Input type="email" defaultValue="brett@example.com" />
      <FieldDescription>Managed by your organization.</FieldDescription>
    </Field>
  ),
};

/** A FieldSet groups fields under a section header; its own description sits under them. */
export const Set: Story = {
  render: () => (
    <FieldSet>
      <FieldLegend>Shipping address</FieldLegend>
      <FieldGroup>
        <Field name="street">
          <FieldLabel variant="field">Street</FieldLabel>
          <Input autoComplete="street-address" />
        </Field>
        <Field name="city">
          <FieldLabel variant="field">City</FieldLabel>
          <Input autoComplete="address-level2" />
        </Field>
      </FieldGroup>
      <FieldDescription>We only ship within the EU.</FieldDescription>
    </FieldSet>
  ),
};
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => fields };

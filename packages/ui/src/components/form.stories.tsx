import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Form } from '@/components/ui/form';
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, Radio } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof Form> = {
  title: 'Organisms/Form',
  component: Form,
};
export default meta;
type Story = StoryObj<typeof Form>;

function Signup({ dark, errors: serverErrors = {} }: { dark?: boolean; errors?: Record<string, string> }) {
  const [sent, setSent] = useState<string | null>(null);
  // A server's errors, by field name: each shows on its field until the field is edited.
  const [errors, setErrors] = useState(serverErrors);
  return (
    <Screen dark={dark} h={860} title="Create account">
      <Form onSubmit={(e) => { e.preventDefault(); setSent(String(new FormData(e.currentTarget).get('email'))); }}>
        <FieldSet>
          <FieldLegend>Account</FieldLegend>
          <Field name="name">
            <FieldLabel variant="field">Full name</FieldLabel>
            <Input required autoComplete="name" defaultValue="Jane Appleseed" />
            <FieldError />
          </Field>
          <Field name="email" invalid={errors.email ? true : undefined}>
            <FieldLabel variant="field">Email</FieldLabel>
            <Input type="email" required placeholder="you@example.com" autoComplete="email" defaultValue={serverErrors.email ? 'jane@example' : ''}
              onValueChange={() => setErrors({})} />
            <FieldError>{(state) => errors.email || state.message}</FieldError>
          </Field>
          <Field name="role">
            <FieldLabel variant="field">Role</FieldLabel>
            <Select defaultValue="design">
              <SelectTrigger />
              <SelectContent>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="eng">Engineering</SelectItem>
                <SelectItem value="pm">Product</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Preferences</FieldLegend>
          <Field name="plan">
            <FieldLabel variant="field">Plan</FieldLabel>
            <RadioGroup defaultValue="free">
              <Label variant="control"><Radio value="free" />Free</Label>
              <Label variant="control"><Radio value="pro" />Pro · $8/mo</Label>
            </RadioGroup>
          </Field>
          <Field name="about">
            <FieldLabel variant="field">About you</FieldLabel>
            <Textarea size="sm" placeholder="Optional" />
            <FieldDescription>Shown on your profile.</FieldDescription>
          </Field>
          <Label variant="control"><Checkbox name="terms" required />I agree to the Terms</Label>
          <FieldDescription>You can change these later in Settings.</FieldDescription>
        </FieldSet>
        <Button type="submit" size="pill">Create Account</Button>
        {sent ? <p className="m-0 text-center text-[13px] text-success">Submitted for {sent}</p> : null}
      </Form>
    </Screen>
  );
}

export const Default: Story = { render: () => <Signup /> };
export const ServerErrors: Story = { render: () => <Signup errors={{ email: 'That address is already registered.' }} /> };
export const Dark: Story = { render: () => <Signup dark /> };

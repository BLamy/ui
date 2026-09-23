import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Form, FormSection } from './form';
import { TextField, FieldDescription, FieldError } from './text-field';
import { Label } from './label';
import { Input } from './input';
import { Textarea } from './textarea';
import { Checkbox } from './checkbox';
import { RadioGroup, Radio } from './radio-group';
import { Select, SelectTrigger, SelectContent, SelectItem } from './select';
import { Button } from './button';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof Form> = {
  title: 'Organisms/Form',
  component: Form,
};
export default meta;
type Story = StoryObj<typeof Form>;

function Signup({ dark, errors }: { dark?: boolean; errors?: Record<string, string> }) {
  const [sent, setSent] = useState<string | null>(null);
  return (
    <Screen dark={dark} h={860} title="Create account">
      <Form
        validationErrors={errors}
        onSubmit={(e) => { e.preventDefault(); setSent(String(new FormData(e.currentTarget).get('email'))); }}
      >
        <FormSection title="Account">
          <TextField name="name" isRequired defaultValue="Jane Appleseed">
            <Label variant="field">Full name</Label>
            <Input autoComplete="name" />
            <FieldError />
          </TextField>
          <TextField name="email" type="email" isRequired defaultValue={errors ? 'jane@example' : ''}>
            <Label variant="field">Email</Label>
            <Input placeholder="you@example.com" autoComplete="email" />
            <FieldError />
          </TextField>
          <Select name="role" defaultValue="design" aria-label="Role">
            <Label variant="field">Role</Label>
            <SelectTrigger />
            <SelectContent>
              <SelectItem id="design">Design</SelectItem>
              <SelectItem id="eng">Engineering</SelectItem>
              <SelectItem id="pm">Product</SelectItem>
            </SelectContent>
          </Select>
        </FormSection>
        <FormSection title="Preferences" description="You can change these later in Settings.">
          <RadioGroup name="plan" defaultValue="free">
            <Label variant="field">Plan</Label>
            <Radio value="free">Free</Radio>
            <Radio value="pro">Pro · $8/mo</Radio>
          </RadioGroup>
          <TextField name="about">
            <Label variant="field">About you</Label>
            <Textarea size="sm" placeholder="Optional" />
            <FieldDescription>Shown on your profile.</FieldDescription>
          </TextField>
          <Checkbox name="terms" isRequired>I agree to the Terms</Checkbox>
        </FormSection>
        <Button type="submit" size="pill">Create Account</Button>
        {sent ? <p className="m-0 text-center text-[13px] text-success">Submitted for {sent}</p> : null}
      </Form>
    </Screen>
  );
}

export const Default: Story = { render: () => <Signup /> };
export const ServerErrors: Story = { render: () => <Signup errors={{ email: 'That address is already registered.' }} /> };
export const Dark: Story = { render: () => <Signup dark /> };

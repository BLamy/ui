import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup, Radio } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof RadioGroup> = {
  title: 'Molecules/RadioGroup',
  component: RadioGroup,
  decorators: [(Story, { parameters }) => <Panel dark={parameters.dark}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof RadioGroup>;

/* In a Field, its label names the group and its description is read with it. */
const plan = (
  <Field className="gap-3">
    <FieldLabel>Billing</FieldLabel>
    <RadioGroup defaultValue="monthly">
      <Label variant="control"><Radio value="monthly" />Monthly</Label>
      <Label variant="control"><Radio value="yearly" />Yearly · save 20%</Label>
      <Label variant="control"><Radio value="lifetime" disabled />Lifetime</Label>
    </RadioGroup>
    <FieldDescription>You can change this at any time.</FieldDescription>
  </Field>
);

export const Vertical: Story = { render: () => plan };

/** Without a Field, a Label whose `htmlFor` is the group's `id` names it. */
export const Horizontal: Story = {
  render: () => (
    <RadioGroup id="size" orientation="horizontal" defaultValue="m">
      <Label htmlFor="size" variant="field" className="w-full">Size</Label>
      <Label variant="control"><Radio value="s" />S</Label>
      <Label variant="control"><Radio value="m" />M</Label>
      <Label variant="control"><Radio value="l" />L</Label>
      <Label variant="control"><Radio value="xl" />XL</Label>
    </RadioGroup>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Field invalid className="gap-3">
      <FieldLabel>Delivery</FieldLabel>
      <RadioGroup>
        <Label variant="control"><Radio value="standard" />Standard</Label>
        <Label variant="control"><Radio value="express" />Express</Label>
      </RadioGroup>
      <FieldError>Choose a delivery option.</FieldError>
    </Field>
  ),
};

export const Dark: Story = { parameters: { dark: true }, render: () => plan };

/** Disabled as a whole, and read-only (focusable, but the choice can't change). */
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      <RadioGroup aria-label="Delivery, disabled" disabled defaultValue="standard">
        <Label variant="control"><Radio value="standard" />Standard</Label>
        <Label variant="control"><Radio value="express" />Express</Label>
      </RadioGroup>
      <RadioGroup aria-label="Delivery, read-only" readOnly defaultValue="express">
        <Label variant="control"><Radio value="standard" />Standard</Label>
        <Label variant="control"><Radio value="express" />Express (read-only)</Label>
      </RadioGroup>
    </div>
  ),
};

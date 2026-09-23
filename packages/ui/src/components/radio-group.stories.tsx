import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup, Radio } from './radio-group';
import { Label } from './label';
import { FieldDescription } from './text-field';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof RadioGroup> = {
  title: 'Molecules/RadioGroup',
  component: RadioGroup,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof RadioGroup>;

const plan = (
  <RadioGroup defaultValue="monthly">
    <Label variant="field">Billing</Label>
    <Radio value="monthly">Monthly</Radio>
    <Radio value="yearly">Yearly · save 20%</Radio>
    <Radio value="lifetime" isDisabled>Lifetime</Radio>
    <FieldDescription>You can change this at any time.</FieldDescription>
  </RadioGroup>
);

export const Vertical: Story = { render: () => plan };

export const Horizontal: Story = {
  render: () => (
    <RadioGroup orientation="horizontal" defaultValue="m">
      <Label variant="field" className="w-full">Size</Label>
      <Radio value="s">S</Radio>
      <Radio value="m">M</Radio>
      <Radio value="l">L</Radio>
      <Radio value="xl">XL</Radio>
    </RadioGroup>
  ),
};

export const Invalid: Story = {
  render: () => (
    <RadioGroup isInvalid>
      <Label variant="field">Delivery</Label>
      <Radio value="standard">Standard</Radio>
      <Radio value="express">Express</Radio>
    </RadioGroup>
  ),
};

export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => plan };

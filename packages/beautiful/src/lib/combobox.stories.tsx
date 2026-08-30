import type { Meta, StoryObj } from '@storybook/react-vite';
import { Combobox } from './combobox';
import { ComboboxDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof Combobox> = {
  title: 'Molecules/Combobox',
  component: Combobox,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof Combobox>;

export const Default: Story = { render: () => <ComboboxDemo /> };
export const WithSelection: Story = {
  args: {
    value: 'Kumo Creamery',
    placeholder: 'Pick a supplier…',
    options: ['Aurora Scoops', 'Kumo Creamery', 'Maple Orbit', 'Coral Coast Sorbet', 'Ember Cone Company', 'Blue Fig Gelato'],
  },
};

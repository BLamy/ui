import type { Meta, StoryObj } from '@storybook/react-vite';
import { Popover } from './popover';
import { CiteDemo, PopoverDropdownDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof Popover> = {
  title: 'Molecules/Popover',
  component: Popover,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof Popover>;

export const PopoverAndDropdown: Story = { render: () => <PopoverDropdownDemo /> };
export const Citations: Story = { render: () => <CiteDemo /> };

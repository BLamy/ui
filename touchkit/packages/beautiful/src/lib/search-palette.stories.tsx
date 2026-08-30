import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchPalette } from './search-palette';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof SearchPalette> = {
  title: 'Organisms/SearchPalette',
  component: SearchPalette,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof SearchPalette>;

export const Default: Story = {};
export const CustomCommands: Story = {
  args: {
    placeholder: 'Search flavors…',
    commands: ['Pistachio', 'Mint Chip', 'Rocky Road', 'Waffle Cone Deluxe'],
  },
};

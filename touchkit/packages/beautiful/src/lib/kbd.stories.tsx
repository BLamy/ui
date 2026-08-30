import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './base';
import { KbdDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof Kbd> = {
  title: 'Atoms/Kbd',
  component: Kbd,
  decorators: [darkDecorator],
  args: { children: '⌘K' },
};
export default meta;
type Story = StoryObj<typeof Kbd>;

export const Default: Story = {};
export const ShortcutList: Story = { render: () => <KbdDemo /> };

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sidebar } from './sidebar';
import { SidebarDemo } from '../demos/sidebar-demo';

const meta: Meta<typeof Sidebar> = {
  title: 'Organisms/Sidebar',
  component: Sidebar,
};
export default meta;
type Story = StoryObj<typeof Sidebar>;

export const Docked: Story = { render: () => <SidebarDemo variant="docked" /> };
export const Rail: Story = { render: () => <SidebarDemo variant="rail" /> };
export const Float: Story = { render: () => <SidebarDemo variant="float" /> };
export const Overlay: Story = { render: () => <SidebarDemo variant="overlay" /> };

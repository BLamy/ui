import type { Meta, StoryObj } from '@storybook/react-vite';
import { SidebarDemo } from './sidebar-demo';

/* The interactive playground. The component's own stories (each look and presentation, light and dark, a phone
   frame) are `Organisms/Sidebar` in packages/ui. */
const meta: Meta<typeof SidebarDemo> = {
  title: 'Blocks/SplitViewDemos/Sidebar playground',
  component: SidebarDemo,
  args: { variant: 'docked', presentation: 'auto', appearance: 'dark' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['docked', 'rail', 'float'] },
    presentation: { control: 'inline-radio', options: ['auto', 'column', 'drawer'] },
    appearance: { control: 'inline-radio', options: ['light', 'dark'] },
  },
};
export default meta;
type Story = StoryObj<typeof SidebarDemo>;

export const Playground: Story = { render: (args) => <SidebarDemo key={`${args.variant}${args.presentation}${args.appearance}`} {...args} /> };

import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommandMenu } from './command-menu';
import { CommandMenuDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof CommandMenu> = {
  title: 'Organisms/CommandMenu',
  component: CommandMenu,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof CommandMenu>;

export const Default: Story = { render: () => <CommandMenuDemo /> };
export const Open: Story = {
  render: () => (
    <div style={{ position: 'relative', height: 340, border: '1px solid var(--wb-sep)', borderRadius: 12, overflow: 'hidden', maxWidth: 640 }}>
      <CommandMenu open onClose={() => undefined}>
        <CommandMenu.Input />
        <CommandMenu.List>
          <CommandMenu.Group title="Agent">
            <CommandMenu.Item icon="bolt" kbd="⌘R" keywords="forecast demand">
              Run demand forecast
            </CommandMenu.Item>
            <CommandMenu.Item icon="doc" keywords="email supplier draft">
              Draft supplier email
            </CommandMenu.Item>
          </CommandMenu.Group>
          <CommandMenu.Group title="Navigate">
            <CommandMenu.Item icon="home" kbd="G H" keywords="go home">
              Go home
            </CommandMenu.Item>
          </CommandMenu.Group>
        </CommandMenu.List>
      </CommandMenu>
    </div>
  ),
};

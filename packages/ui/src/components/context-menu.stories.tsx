import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut,
} from '@/components/ui/context-menu';
import { Icon } from '@/lib/icon';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof ContextMenu> = {
  title: 'Molecules/ContextMenu',
  component: ContextMenu,
};
export default meta;
type Story = StoryObj<typeof ContextMenu>;

/** Right-click the tile (long-press on a touch screen, or focus it and press the menu key): the menu opens at the pointer. */
function Tile() {
  return (
    <ContextMenu className="rounded-xl">
      <button type="button" className="grid h-40 w-full cursor-pointer place-items-center rounded-xl border-0 bg-muted text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Right-click me
      </button>
      <ContextMenuContent aria-label="Photo actions">
        <ContextMenuItem icon={<Icon name="layers" size={20} />}>Copy</ContextMenuItem>
        <ContextMenuItem icon={<Icon name="star" size={20} />} shortcut={<ContextMenuShortcut>⌘D</ContextMenuShortcut>}>Favorite</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" icon={<Icon name="trash" size={20} />}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const Area: Story = { render: () => <Screen h={420}><Tile /></Screen> };
export const AreaDark: Story = { render: () => <Screen dark h={420}><Tile /></Screen> };

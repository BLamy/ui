import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
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
    <ContextMenu>
      <ContextMenuTrigger className="rounded-xl">
        <button type="button" className="grid h-40 w-full cursor-pointer place-items-center rounded-xl border-0 bg-muted text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Right-click me
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent aria-label="Photo actions">
        <ContextMenuItem value="copy" icon={<Icon name="layers" size={20} />}>Copy</ContextMenuItem>
        <ContextMenuItem value="favorite" icon={<Icon name="star" size={20} />} shortcut="mod+d">Favorite</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const Area: Story = { render: () => <Screen h={420}><Tile /></Screen> };
export const AreaDark: Story = { render: () => <Screen dark h={420}><Tile /></Screen> };

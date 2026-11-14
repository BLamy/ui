import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuContextTrigger, DropdownMenuGroupLabel, DropdownMenuItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger, type DropdownMenuData,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Molecules/DropdownMenu',
  component: DropdownMenu,
  argTypes: { presentation: { control: 'inline-radio', options: ['popover', 'auto', 'sheet'] } },
};
export default meta;
type Story = StoryObj<typeof DropdownMenu>;

function Actions({ open = true, ...menu }: { open?: boolean } & ComponentProps<typeof DropdownMenu>) {
  return (
    <DropdownMenu defaultOpen={open} {...menu}>
      <DropdownMenuTrigger render={<Button variant="secondary" size="icon" aria-label="More" />}>
        <Icon name="ellipsis" size={20} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem value="copy" icon={<Icon name="layers" size={20} />}>Copy</DropdownMenuItem>
        <DropdownMenuItem value="share" icon={<Icon name="mail" size={20} />}>Share…</DropdownMenuItem>
        <DropdownMenuItem value="favorite" icon={<Icon name="star" size={20} />}>Favorite</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="info" icon={<Icon name="info" size={20} />} description="Captured Sep 22">Show Info</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Open: Story = { render: (args) => <Screen h={560}><div><Actions {...args} /></div></Screen> };
export const OpenDark: Story = { render: (args) => <Screen dark h={560}><div><Actions {...args} /></div></Screen> };

/** Radio items hold one value; checkbox items toggle on their own. Both keep the menu open. */
export const Selectable: Story = {
  render: () => (
    <Screen h={560}>
      <div>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<Button variant="secondary" />}>Sort</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup defaultValue="date">
              <DropdownMenuGroupLabel>Sort By</DropdownMenuGroupLabel>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="date">Date Modified</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="kind">Kind</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem value="hidden" defaultChecked>Show Hidden Files</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Screen>
  ),
};

export const ShortcutsAndSubmenu: Story = {
  render: () => (
    <Screen h={560}>
      <div>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<Button variant="secondary" />}>File</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem value="new" shortcut="mod+n">New Window</DropdownMenuItem>
            <DropdownMenuItem value="open" shortcut="mod+o">Open…</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Open Recent</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem value="design-review">design-review.key</DropdownMenuItem>
                <DropdownMenuItem value="roadmap">roadmap.md</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem value="save" disabled shortcut="mod+s">Save</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Screen>
  ),
};

const file: DropdownMenuData = [
  { value: 'open', label: 'Open…', shortcut: 'mod+o', icon: <Icon name="folder" size={20} /> },
  { value: 'duplicate', label: 'Duplicate', shortcut: 'mod+shift+d', description: 'Next to the original' },
  { type: 'separator' },
  { type: 'checkbox', value: 'toolbar', label: 'Toolbar', defaultChecked: true },
  { type: 'radio-group', name: 'sort', label: 'Sort by', defaultValue: 'name', items: [{ value: 'name', label: 'Name' }, { value: 'date', label: 'Date modified' }] },
  { type: 'separator' },
  { type: 'submenu', label: 'Share', items: ['Copy link', 'Email'] },
  { value: 'delete', label: 'Delete', destructive: true },
];

/** The same rows from data: `items` on the menu and an empty content. The shortcuts run while the menu is closed. */
export const FromData: Story = {
  render: () => (
    <Screen h={640}>
      <div>
        <DropdownMenu defaultOpen items={file}>
          <DropdownMenuTrigger render={<Button variant="secondary" />}>File</DropdownMenuTrigger>
          <DropdownMenuContent />
        </DropdownMenu>
      </div>
    </Screen>
  ),
};

/** `presentation="sheet"`: the menu slides up from the bottom of its host, with the Sheet's grabber; a submenu
    takes its place. `presentation="auto"` does this in a compact container (a phone). */
export const Sheet: Story = { args: { presentation: 'sheet' }, render: (args) => <Screen h={560}><div><Actions {...args} /></div></Screen> };
export const SheetDark: Story = { args: { presentation: 'sheet' }, render: (args) => <Screen dark h={560}><div><Actions {...args} /></div></Screen> };

/** `size="sm"` on the content: the dense desktop menu, 32px rounded rows of footnote text and hairline separators.
    Submenus inherit it. */
function Compact({ dark = false }: { dark?: boolean }) {
  return (
    <Screen dark={dark} h={480}>
      <div>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<Button variant="secondary" size="sm" />}>Effort: Medium</DropdownMenuTrigger>
          <DropdownMenuContent size="sm" align="start">
            <DropdownMenuRadioGroup defaultValue="medium">
              <DropdownMenuGroupLabel>Reasoning effort</DropdownMenuGroupLabel>
              <DropdownMenuRadioItem value="low" closeOnSelect description="Fastest">Low</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium" closeOnSelect description="Balanced">Medium</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="high" closeOnSelect description="Most thorough" disabled>High</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem value="settings" shortcut="mod+,">Settings…</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Model</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem value="opus">Opus</DropdownMenuItem>
                <DropdownMenuItem value="sonnet">Sonnet</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Screen>
  );
}
export const Small: Story = { render: () => <Compact /> };
export const SmallDark: Story = { render: () => <Compact dark /> };

/** Disabled items stay in place, dimmed, and the keyboard skips them; a destructive item is tinted. */
export const DisabledAndDestructive: Story = {
  render: () => (
    <Screen h={420}>
      <div>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<Button variant="secondary" />}>Edit</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem value="undo" disabled shortcut="mod+z">Undo</DropdownMenuItem>
            <DropdownMenuItem value="redo" disabled shortcut="mod+shift+z">Redo</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Screen>
  ),
};

/** A context menu: the same menu with a DropdownMenuContextTrigger. Right-click the tile (long-press on a touch
    screen, or focus it and press the menu key or Shift+F10). Open here at the tile. */
function Tile({ dark = false, open = true }: { dark?: boolean; open?: boolean }) {
  return (
    <Screen dark={dark} h={480}>
      <DropdownMenu defaultOpen={open}>
        <DropdownMenuContextTrigger className="rounded-xl">
          <button type="button" className="grid h-40 w-full cursor-pointer place-items-center rounded-xl border-0 bg-muted font-[inherit] text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Right-click me
          </button>
        </DropdownMenuContextTrigger>
        <DropdownMenuContent aria-label="Photo actions">
          <DropdownMenuItem value="copy" icon={<Icon name="layers" size={20} />}>Copy</DropdownMenuItem>
          <DropdownMenuItem value="favorite" icon={<Icon name="star" size={20} />} shortcut="mod+d">Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Screen>
  );
}
export const ContextMenu: Story = { render: () => <Tile /> };
export const ContextMenuDark: Story = { render: () => <Tile dark /> };
export const ContextMenuClosed: Story = { render: () => <Tile open={false} /> };

/** `palette="trigger"`: the trigger sits on a surface painted by CSS (here plain classes and variables, not a
    ThemeScope), and the menu, which renders in the layer host, copies that surface's palette when it opens. */
export const TriggerPalette: Story = {
  render: () => (
    <Screen h={480}>
      <div className="dark rounded-card bg-card p-4 text-foreground [--card:oklch(0.27_0.04_265)] [--popover:oklch(0.27_0.04_265)]">
        <p className="m-0 mb-3 text-footnote text-muted-foreground">A surface painted by CSS</p>
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger render={<Button variant="secondary" size="sm" />}>Workspace</DropdownMenuTrigger>
            <DropdownMenuContent size="sm" palette="trigger" align="start">
              <DropdownMenuItem value="rename">Rename…</DropdownMenuItem>
              <DropdownMenuItem value="archive">Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </Screen>
  ),
};

export const Closed: Story = { render: (args) => <Screen h={260}><div><Actions open={false} {...args} /></div></Screen> };

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroupLabel, DropdownMenuItem, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
  type MenuData,
} from '@/components/ui/dropdown-menu';
import { buttonVariants } from '@/components/ui/button';
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
      <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label="More">
        <span className="text-[20px] leading-none">⋯</span>
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
          <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })}>Sort</DropdownMenuTrigger>
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
          <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })}>File</DropdownMenuTrigger>
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

const file: MenuData = [
  { value: 'open', label: 'Open…', shortcut: 'mod+o' },
  { value: 'duplicate', label: 'Duplicate', shortcut: 'mod+d' },
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
          <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })}>File</DropdownMenuTrigger>
          <DropdownMenuContent />
        </DropdownMenu>
      </div>
    </Screen>
  ),
};

/** `presentation="sheet"`: the menu slides up from the bottom of its host; a submenu takes its place. */
export const Sheet: Story = { args: { presentation: 'sheet' }, render: (args) => <Screen h={560}><div><Actions {...args} /></div></Screen> };

export const Closed: Story = { render: (args) => <Screen h={260}><div><Actions open={false} {...args} /></div></Screen> };

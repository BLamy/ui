import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSection, DropdownMenuSeparator, DropdownMenuSub,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Icon } from '@/lib/icon';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof DropdownMenuContent> = {
  title: 'Molecules/DropdownMenu',
  component: DropdownMenuContent,
};
export default meta;
type Story = StoryObj<typeof DropdownMenuContent>;

function Actions({ open = true }: { open?: boolean }) {
  return (
    <DropdownMenu defaultOpen={open}>
      <Button variant="secondary" size="icon" aria-label="More"><span className="text-[20px] leading-none">⋯</span></Button>
      <DropdownMenuContent aria-label="Photo actions">
        <DropdownMenuItem icon={<Icon name="layers" size={20} />}>Copy</DropdownMenuItem>
        <DropdownMenuItem icon={<Icon name="mail" size={20} />}>Share…</DropdownMenuItem>
        <DropdownMenuItem icon={<Icon name="star" size={20} />}>Favorite</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Icon name="info" size={20} />} description="Captured Sep 22">Show Info</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" icon={<Icon name="trash" size={20} />}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Open: Story = { render: () => <Screen h={560}><div><Actions /></div></Screen> };
export const OpenDark: Story = { render: () => <Screen dark h={560}><div><Actions /></div></Screen> };

export const Selectable: Story = {
  render: () => (
    <Screen h={520}>
      <div>
        <DropdownMenu defaultOpen>
          <Button variant="secondary">Sort</Button>
          <DropdownMenuContent aria-label="Sort by" selectionMode="single" defaultSelectedKeys={['date']}>
            <DropdownMenuSection title="Sort By">
              <DropdownMenuItem id="name">Name</DropdownMenuItem>
              <DropdownMenuItem id="date">Date Modified</DropdownMenuItem>
              <DropdownMenuItem id="size">Size</DropdownMenuItem>
              <DropdownMenuItem id="kind">Kind</DropdownMenuItem>
            </DropdownMenuSection>
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
          <Button variant="secondary">File</Button>
          <DropdownMenuContent aria-label="File">
            <DropdownMenuItem shortcut={<KbdGroup><Kbd>⌘</Kbd><Kbd>N</Kbd></KbdGroup>}>New Window</DropdownMenuItem>
            <DropdownMenuItem shortcut={<KbdGroup><Kbd>⌘</Kbd><Kbd>O</Kbd></KbdGroup>}>Open…</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuItem>Open Recent</DropdownMenuItem>
              <DropdownMenuContent aria-label="Recent">
                <DropdownMenuItem>design-review.key</DropdownMenuItem>
                <DropdownMenuItem>roadmap.md</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem isDisabled shortcut={<KbdGroup><Kbd>⌘</Kbd><Kbd>S</Kbd></KbdGroup>}>Save</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Screen>
  ),
};

export const Closed: Story = { render: () => <Screen h={260}><div><Actions open={false} /></div></Screen> };

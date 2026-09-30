import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ListBox, ListBoxItem } from '@/components/ui/list-box';
import { Switch } from '@/components/ui/switch';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof SheetContent> = {
  title: 'Organisms/Sheet',
  component: SheetContent,
  args: { side: 'bottom' },
  argTypes: { side: { control: 'inline-radio', options: ['bottom', 'top', 'left', 'right'] } },
};
export default meta;
type Story = StoryObj<typeof SheetContent>;

function Demo({ side, dark, open = true }: { side: 'bottom' | 'top' | 'left' | 'right'; dark?: boolean; open?: boolean }) {
  return (
    <Screen dark={dark}>
      <div>
        <Sheet defaultOpen={open}>
          <Button variant="secondary">Filters</Button>
          <SheetContent side={side}>
            {({ close }) => (
              <>
                <SheetClose />
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Narrow the list of messages.</SheetDescription>
                </SheetHeader>
                <SheetBody className="flex flex-col gap-3">
                  <ListBox aria-label="Mailbox" selectionMode="single" defaultSelectedKeys={['all']} className="bg-muted">
                    <ListBoxItem id="all">All Mail</ListBoxItem>
                    <ListBoxItem id="unread">Unread</ListBoxItem>
                    <ListBoxItem id="flagged">Flagged</ListBoxItem>
                  </ListBox>
                  <div className="flex items-center justify-between rounded-[12px] bg-muted px-4 py-2 text-[17px] text-foreground">
                    Only with attachments <Switch checked onChange={() => {}} aria-label="Only with attachments" />
                  </div>
                </SheetBody>
                <SheetFooter>
                  <Button size="pill" onPress={close}>Apply</Button>
                </SheetFooter>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Screen>
  );
}

export const Bottom: Story = { render: () => <Demo side="bottom" /> };
export const BottomDark: Story = { render: () => <Demo side="bottom" dark /> };
export const Right: Story = { render: () => <Demo side="right" /> };
export const Left: Story = { render: () => <Demo side="left" dark /> };
export const Top: Story = { render: () => <Demo side="top" /> };
export const Closed: Story = { render: () => <Demo side="bottom" open={false} /> };

import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Sheet, SheetBackdrop, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Listbox, ListboxItem } from '@/components/ui/list-box';
import { Switch } from '@/components/ui/switch';
import { Screen } from '../stories/primitive-frame';

type Side = 'bottom' | 'top' | 'left' | 'right';

const meta: Meta<typeof Sheet> = {
  title: 'Organisms/Sheet',
  component: Sheet,
  args: { side: 'bottom' },
  argTypes: { side: { control: 'inline-radio', options: ['bottom', 'top', 'left', 'right'] } },
};
export default meta;
type Story = StoryObj<typeof Sheet>;

function Demo({ side, dark, open = true, snapPoints }: { side: Side; dark?: boolean; open?: boolean; snapPoints?: number[] }) {
  return (
    <Screen dark={dark}>
      <div>
        <Sheet side={side} defaultOpen={open} snapPoints={snapPoints}>
          <SheetTrigger className={buttonVariants({ variant: 'secondary' })}>Filters</SheetTrigger>
          <SheetBackdrop />
          <SheetContent className={snapPoints ? 'h-[calc(100%-48px)]' : undefined}>
            <SheetClose />
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow the list of messages.</SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-3">
              <Listbox aria-label="Mailbox" defaultValue="all" className="bg-muted">
                <ListboxItem value="all">All Mail</ListboxItem>
                <ListboxItem value="unread">Unread</ListboxItem>
                <ListboxItem value="flagged">Flagged</ListboxItem>
              </Listbox>
              <Label variant="control" className="justify-between rounded-[12px] bg-muted px-4 py-2">
                Only with attachments <Switch defaultChecked />
              </Label>
            </SheetBody>
            <SheetFooter>
              <SheetClose render={<Button size="pill" />}>Apply</SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </Screen>
  );
}

export const Bottom: Story = { render: (args) => <Demo side={(args.side as Side) ?? 'bottom'} /> };
export const BottomDark: Story = { render: () => <Demo side="bottom" dark /> };
export const Right: Story = { render: () => <Demo side="right" /> };
export const Left: Story = { render: () => <Demo side="left" dark /> };
export const Top: Story = { render: () => <Demo side="top" /> };
/** Two places to rest: the grabber becomes a handle (press it, or use the arrow keys), and a drag settles on one. */
export const SnapPoints: Story = { render: () => <Demo side="bottom" snapPoints={[0.5, 1]} /> };
export const Closed: Story = { render: () => <Demo side="bottom" open={false} /> };

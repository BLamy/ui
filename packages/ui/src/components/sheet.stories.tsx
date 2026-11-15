import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Sheet, SheetBack, SheetBackdrop, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger, SheetView,
} from '@/components/ui/sheet';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Listbox, ListboxItem } from '@/components/ui/listbox';
import { Switch } from '@/components/ui/switch';
import { focusRing } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { Phone } from '../stories/frame';
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
export const RightDark: Story = { render: () => <Demo side="right" dark /> };
export const Left: Story = { render: () => <Demo side="left" /> };
export const LeftDark: Story = { render: () => <Demo side="left" dark /> };
export const Top: Story = { render: () => <Demo side="top" /> };
/** Two places to rest: the grabber becomes a handle (press it, or use the arrow keys), and a drag settles on one. */
export const SnapPoints: Story = { render: () => <Demo side="bottom" snapPoints={[0.5, 1]} /> };
export const Closed: Story = { render: () => <Demo side="bottom" open={false} /> };

/** A flow: the root's `view` and a `SheetView` spring the short sheet to each step's height, and the step and its
 *  title slide in the direction of travel. The header is Dialog's flow bar: SheetBack folds in on the second step,
 *  the title travels, the × stays at the end of the row. */
function Flow({ dark, start = 'pick' }: { dark?: boolean; start?: 'pick' | 'confirm' }) {
  const [step, setStep] = useState<'pick' | 'confirm'>(start);
  return (
    <Screen dark={dark}>
      <div>
        <Sheet defaultOpen view={step} onOpenChange={(open) => open && setStep('pick')}>
          <SheetTrigger className={buttonVariants()}>Upgrade plan</SheetTrigger>
          <SheetBackdrop />
          <SheetContent>
            {/* The header stays mounted outside the view: the title travels by itself and keeps naming the sheet. */}
            <SheetHeader variant="bar">
              <SheetBack hidden={step === 'pick'} onClick={() => setStep('pick')} />
              <SheetTitle>{step === 'pick' ? 'Choose a plan' : 'Confirm Team'}</SheetTitle>
              <SheetClose />
            </SheetHeader>
            <SheetView>
              {step === 'pick' ? (
                <>
                  <SheetBody className="flex flex-col gap-2">
                    <SheetDescription>You can change it any time.</SheetDescription>
                    <Button variant="secondary" size="lg" className="justify-between">Starter <span>$0</span></Button>
                    <Button size="lg" className="justify-between">Team <span>$12</span></Button>
                  </SheetBody>
                  <SheetFooter>
                    <Button size="pill" onClick={() => setStep('confirm')}>Continue</Button>
                  </SheetFooter>
                </>
              ) : (
                <>
                  <SheetBody>
                    <SheetDescription>$12 per seat each month, billed today.</SheetDescription>
                  </SheetBody>
                  <SheetFooter>
                    <SheetClose render={<Button size="pill" />}>Confirm and pay</SheetClose>
                  </SheetFooter>
                </>
              )}
            </SheetView>
          </SheetContent>
        </Sheet>
      </div>
    </Screen>
  );
}
export const FlowInTray: Story = { render: () => <Flow /> };
/** The second step: the back chevron has folded into the bar. */
export const FlowSecondStep: Story = { render: () => <Flow start="confirm" /> };
export const FlowDark: Story = { render: () => <Flow dark start="confirm" /> };

/** `dismissible={false}`: no ×, no grabber, no swipe or scrim close; only an answer closes it. Two answers share a
 *  `horizontal` footer. */
function Required({ dark }: { dark?: boolean }) {
  return (
    <Screen dark={dark}>
      <div>
        <Sheet defaultOpen dismissible={false}>
          <SheetTrigger className={buttonVariants()}>Terms</SheetTrigger>
          <SheetBackdrop />
          <SheetContent>
            <SheetClose />
            <SheetHeader>
              <SheetTitle>New terms of service</SheetTitle>
              <SheetDescription>Read and accept them to keep syncing your library.</SheetDescription>
            </SheetHeader>
            <SheetFooter orientation="horizontal">
              <SheetClose render={<Button size="pill" variant="secondary" />}>Later</SheetClose>
              <SheetClose render={<Button size="pill" />}>Accept</SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </Screen>
  );
}
export const NotDismissible: Story = { render: () => <Required /> };
export const NotDismissibleDark: Story = { render: () => <Required dark /> };

/** `contained`: the sheet stays inside its positioned parent (the framed box under the toolbar), with
 *  `SheetContent variant="panel"`, a full-height edge panel without chrome. The toolbar stays usable. */
function Contained({ dark, modal = true }: { dark?: boolean; modal?: boolean }) {
  const [folder, setFolder] = useState('Inbox');
  return (
    <Phone w={390} h={844} dark={dark}>
      <div className="absolute inset-0 flex flex-col">
        <header className="flex h-toolbar shrink-0 items-center gap-2 border-b border-border px-4 text-body">
          <strong className="flex-1">Mail</strong>
          <span className="text-muted-foreground">{folder}</span>
        </header>
        <div className="relative m-3 min-h-0 flex-1 overflow-hidden rounded-card bg-muted shadow-hairline">
          <Sheet contained side="left" defaultOpen modal={modal}>
            <div className="p-4">
              <SheetTrigger className={buttonVariants({ variant: 'secondary' })}>Folders</SheetTrigger>
            </div>
            {modal ? <SheetBackdrop /> : null}
            <SheetContent variant="panel" aria-label="Folders" className="w-60 p-2">
              {['Inbox', 'Drafts', 'Sent', 'Archive'].map((f) => (
                <button key={f} type="button" onClick={() => setFolder(f)} aria-current={f === folder || undefined}
                  className={cn('block w-full cursor-pointer rounded-ctl border-0 bg-transparent px-3 py-2 text-start text-body text-foreground hover:bg-secondary aria-[current]:bg-secondary-strong', focusRing)}>
                  {f}
                </button>
              ))}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </Phone>
  );
}
export const ContainedPanel: Story = { render: () => <Contained /> };
export const ContainedPanelDark: Story = { render: () => <Contained dark /> };
/** `modal={false}`: no scrim, and the box behind the panel stays usable. */
export const ContainedBeside: Story = { render: () => <Contained modal={false} /> };

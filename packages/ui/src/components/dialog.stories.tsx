import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Dialog, DialogBack, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger, DialogView,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Icon } from '@/lib/icon';
import { Phone } from '../stories/frame';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof DialogContent> = {
  title: 'Organisms/Dialog',
  component: DialogContent,
};
export default meta;
type Story = StoryObj<typeof DialogContent>;

/* Frames: 720px wide is a medium container (Dialog is a centered card), 390px is compact (a sheet or a tray). */
const REGULAR = { w: 720, h: 560 };
const COMPACT = { w: 390, h: 720 };

function Alert({ open = true }: { open?: boolean }) {
  return (
    <AlertDialog defaultOpen={open}>
      <AlertDialogTrigger className={buttonVariants({ variant: 'destructive' })}>Delete Photo…</AlertDialogTrigger>
      <AlertDialogBackdrop />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
          <AlertDialogDescription>This photo will be deleted from iCloud Photos on all your devices.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
          <AlertDialogClose tone="destructive" value="confirm">Delete</AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** An alert stays a centered card in every container, a phone-sized one included. */
export const AlertOpen: Story = { render: () => <Screen><div><Alert /></div></Screen> };
export const AlertDark: Story = { render: () => <Screen dark><div><Alert /></div></Screen> };

export const AlertStacked: Story = {
  render: () => (
    <Screen>
      <div>
        <AlertDialog defaultOpen>
          <AlertDialogTrigger className={buttonVariants({ variant: 'secondary' })}>Sign Out…</AlertDialogTrigger>
          <AlertDialogBackdrop />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of iCloud?</AlertDialogTitle>
              <AlertDialogDescription>Keep a copy of your data on this iPhone?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter orientation="vertical">
              <AlertDialogClose value="keep">Keep a Copy</AlertDialogClose>
              <AlertDialogClose tone="destructive" value="confirm">Delete from iPhone</AlertDialogClose>
              <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Screen>
  ),
};

function Rename({ size, variant, presentation }: { size?: 'default' | 'lg'; variant?: 'default' | 'tray'; presentation?: 'dialog' | 'sheet' }) {
  return (
    <Dialog defaultOpen presentation={presentation}>
      <DialogTrigger className={buttonVariants()}>Rename…</DialogTrigger>
      <DialogBackdrop />
      <DialogContent size={size} variant={variant} initialFocus="input">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>Project names are visible to everyone in the workspace.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>Name</FieldLabel>
            <Input defaultValue="Aurora redesign" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
          <DialogClose render={<Button />} value="save">Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Stage = ({ children }: { children?: React.ReactNode }) => (
  <div className="absolute inset-0 grid place-items-center p-5">{children}</div>
);

/** In a medium or regular container the default (`presentation="auto"`) is a centered card. */
export const DefaultOpen: Story = { render: () => <Phone {...REGULAR}><Stage><Rename /></Stage></Phone> };
export const DefaultDark: Story = { render: () => <Phone {...REGULAR} appearance="dark"><Stage><Rename /></Stage></Phone> };
export const Large: Story = { render: () => <Phone w={760} h={560}><Stage><Rename size="lg" /></Stage></Phone> };
/** The same dialog in a compact container: a sheet attached to the bottom edge, with a grabber, buttons sharing the row. */
export const Compact: Story = { render: () => <Phone {...COMPACT}><Stage><Rename /></Stage></Phone> };
export const CompactDark: Story = { render: () => <Phone {...COMPACT} appearance="dark"><Stage><Rename /></Stage></Phone> };
/** `variant="tray"` in a compact container: a tray floating inset from the edges. */
export const CompactTray: Story = { render: () => <Phone {...COMPACT}><Stage><Rename variant="tray" /></Stage></Phone> };
export const CompactTrayDark: Story = { render: () => <Phone {...COMPACT} appearance="dark"><Stage><Rename variant="tray" /></Stage></Phone> };
/** `presentation="dialog"` opts out: a centered card even in a compact container. */
export const CompactPinnedToDialog: Story = { render: () => <Phone {...COMPACT}><Stage><Rename presentation="dialog" /></Stage></Phone> };

/** One dialog, two widths: switch the frame and open it again. "auto" is decided each time it opens. */
function Resizable() {
  const [wide, setWide] = useState(false);
  return (
    <div className="grid justify-items-center gap-3">
      <div className="flex gap-2">
        <Button size="sm" variant={wide ? 'secondary' : 'default'} onClick={() => setWide(false)}>Compact · 390</Button>
        <Button size="sm" variant={wide ? 'default' : 'secondary'} onClick={() => setWide(true)}>Medium · 720</Button>
      </div>
      <Phone key={wide ? 'wide' : 'narrow'} w={wide ? 720 : 390} h={560}>
        <Stage><Rename variant="tray" /></Stage>
      </Phone>
    </div>
  );
}
export const AutoInResizableFrame: Story = { render: () => <Resizable /> };

const TITLES: Record<string, string> = { menu: 'Share Contact', qr: 'QR Code', done: 'Card Shared' };

function ShareViews({ view, go }: { view: string; go: (view: string) => void }) {
  if (view === 'qr') {
    return (
      <>
        <DialogBody className="grid justify-items-center gap-3 text-center">
          <div className="grid size-40 place-items-center rounded-card bg-secondary text-muted-foreground"><Icon name="qrcode" size={96} /></div>
          <DialogDescription>Scanning adds Wei Chen: name, phone and email.</DialogDescription>
        </DialogBody>
        <DialogFooter orientation="vertical">
          <Button size="pill" onClick={() => go('done')}>Save to Photos</Button>
        </DialogFooter>
      </>
    );
  }
  if (view === 'done') {
    return (
      <>
        <DialogBody className="grid justify-items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success text-primary-foreground"><Icon name="check" size={26} sw={3} /></span>
          <DialogDescription>Wei Chen is on the way.</DialogDescription>
        </DialogBody>
        <DialogFooter orientation="vertical">
          <DialogClose render={<Button size="pill" />}>Done</DialogClose>
        </DialogFooter>
      </>
    );
  }
  return (
    <>
      <DialogBody className="grid gap-2">
        <DialogDescription>Pick how to share Wei’s card.</DialogDescription>
        {([['qrcode', 'QR Code', 'Scan in person', 'qr'], ['mail', 'Export vCard', 'Send the .vcf anywhere', 'done']] as const).map(([icon, title, detail, target]) => (
          <Button key={title} variant="secondary" className="h-auto justify-start gap-3 px-3 py-2.5 text-left" onClick={() => go(target)}>
            <Icon name={icon} size={20} className="text-primary" />
            <span className="grid min-w-0 flex-1">
              <span className="text-callout font-semibold">{title}</span>
              <span className="text-footnote font-normal text-muted-foreground">{detail}</span>
            </span>
            <Icon name="chev" size={14} sw={2.6} className="text-tertiary-foreground" />
          </Button>
        ))}
      </DialogBody>
      <div className="h-3" />
    </>
  );
}

/** A flow: `view` on the root, a `bar` header with DialogBack, and DialogView springing the height between steps. */
function Share({ start = 'menu' }: { start?: string }) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState(start);
  return (
    <>
      <Stage><Button onClick={() => { setView('menu'); setOpen(true); }}>Share Contact…</Button></Stage>
      <Dialog open={open} onOpenChange={setOpen} view={view}>
        <DialogBackdrop />
        <DialogContent variant="tray">
          <DialogHeader variant="bar">
            <DialogBack hidden={view === 'menu'} onClick={() => setView('menu')} />
            <DialogTitle>{TITLES[view]}</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <DialogView><ShareViews view={view} go={setView} /></DialogView>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Step with the buttons (or `--do click:role=button[name="QR Code"]`): the card springs to each view's height, the
    title travels with it, and the back chevron grows in. */
export const Flow: Story = { render: () => <Phone {...REGULAR}><Share /></Phone> };
export const FlowDark: Story = { render: () => <Phone {...REGULAR} appearance="dark"><Share /></Phone> };
export const FlowCompact: Story = { render: () => <Phone {...COMPACT}><Share /></Phone> };
export const FlowCompactDark: Story = { render: () => <Phone {...COMPACT} appearance="dark"><Share /></Phone> };
/** The second step of the flow, open from the start: the back chevron is in the bar. */
export const FlowSecondStep: Story = { render: () => <Phone {...COMPACT}><Share start="qr" /></Phone> };

/** A long title in a bar wraps instead of running under the ×. */
export const LongTitle: Story = {
  render: () => (
    <Phone {...COMPACT}>
      <Dialog defaultOpen view="one">
        <DialogBackdrop />
        <DialogContent variant="tray">
          <DialogHeader variant="bar">
            <DialogTitle>Delete “quarterly-planning-notes-final-v3-reviewed.md” and its history?</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <DialogView>
            <DialogBody><DialogDescription>This file will be deleted. It can’t be restored.</DialogDescription></DialogBody>
            <DialogFooter>
              <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
              <DialogClose render={<Button variant="destructive" />} value="delete">Delete</DialogClose>
            </DialogFooter>
          </DialogView>
        </DialogContent>
      </Dialog>
    </Phone>
  ),
};

/** `dismissible={false}`: a step to finish. No × and no grabber; Escape, the scrim and a drag down leave it up. */
function Terms() {
  return (
    <Dialog defaultOpen dismissible={false}>
      <DialogBackdrop />
      <DialogContent variant="tray">
        <DialogHeader variant="bar"><DialogTitle>Updated terms</DialogTitle><DialogClose /></DialogHeader>
        <DialogBody>
          <DialogDescription>Shared albums now keep their photos for a year. Agree to keep sharing: this stays until you do.</DialogDescription>
        </DialogBody>
        <DialogFooter orientation="vertical">
          <DialogClose render={<Button size="pill" />}>Agree and Continue</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export const NonDismissible: Story = { render: () => <Phone {...COMPACT}><Terms /></Phone> };
export const NonDismissibleRegular: Story = { render: () => <Phone {...REGULAR}><Terms /></Phone> };

export const Closed: Story = { render: () => <Screen h={260}><div><Alert open={false} /></div></Screen> };

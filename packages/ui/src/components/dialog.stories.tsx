import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Dialog, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof DialogContent> = {
  title: 'Organisms/Dialog',
  component: DialogContent,
};
export default meta;
type Story = StoryObj<typeof DialogContent>;

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
          <AlertDialogClose variant="destructive" value="confirm">Delete</AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
              <AlertDialogClose variant="destructive" value="confirm">Delete from iPhone</AlertDialogClose>
              <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Screen>
  ),
};

function Rename({ dark, size, presentation }: { dark?: boolean; size?: 'default' | 'lg'; presentation?: 'sheet' }) {
  return (
    <Screen dark={dark}>
      <div>
        <Dialog defaultOpen presentation={presentation}>
          <DialogTrigger className={buttonVariants()}>Rename…</DialogTrigger>
          <DialogBackdrop />
          <DialogContent size={size} initialFocus="input">
            <DialogClose />
            <DialogHeader>
              <DialogTitle>Rename project</DialogTitle>
              <DialogDescription>Project names are visible to everyone in the workspace.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field>
                <FieldLabel variant="field">Name</FieldLabel>
                <Input defaultValue="Aurora redesign" />
              </Field>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
              <DialogClose render={<Button />} value="save">Save</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Screen>
  );
}

export const DefaultOpen: Story = { render: () => <Rename /> };
export const DefaultDark: Story = { render: () => <Rename dark /> };
export const Large: Story = { render: () => <Rename size="lg" /> };
/** `presentation="sheet"`: the same dialog as a bottom sheet (`"auto"` picks it in a compact container). */
export const AsSheet: Story = { render: () => <Rename presentation="sheet" /> };
export const Closed: Story = { render: () => <Screen h={260}><div><Alert open={false} /></div></Screen> };

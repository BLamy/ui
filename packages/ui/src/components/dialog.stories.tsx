import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogAction, DialogClose,
} from './dialog';
import { Button } from './button';
import { TextField } from './text-field';
import { Label } from './label';
import { Input } from './input';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof DialogContent> = {
  title: 'Organisms/Dialog',
  component: DialogContent,
};
export default meta;
type Story = StoryObj<typeof DialogContent>;

function Alert({ open = true }: { open?: boolean }) {
  return (
    <DialogTrigger defaultOpen={open}>
      <Button variant="destructive">Delete Photo…</Button>
      <DialogContent size="alert">
        <DialogHeader>
          <DialogTitle>Delete this photo?</DialogTitle>
          <DialogDescription>This photo will be deleted from iCloud Photos on all your devices.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogAction variant="cancel">Cancel</DialogAction>
          <DialogAction variant="destructive">Delete</DialogAction>
        </DialogFooter>
      </DialogContent>
    </DialogTrigger>
  );
}

export const AlertOpen: Story = { render: () => <Screen><div><Alert /></div></Screen> };
export const AlertDark: Story = { render: () => <Screen dark><div><Alert /></div></Screen> };

export const AlertStacked: Story = {
  render: () => (
    <Screen>
      <div>
        <DialogTrigger defaultOpen>
          <Button variant="secondary">Sign Out…</Button>
          <DialogContent size="alert">
            <DialogHeader>
              <DialogTitle>Sign out of iCloud?</DialogTitle>
              <DialogDescription>Keep a copy of your data on this iPhone?</DialogDescription>
            </DialogHeader>
            <DialogFooter orientation="vertical">
              <DialogAction>Keep a Copy</DialogAction>
              <DialogAction variant="destructive">Delete from iPhone</DialogAction>
              <DialogAction variant="cancel">Cancel</DialogAction>
            </DialogFooter>
          </DialogContent>
        </DialogTrigger>
      </div>
    </Screen>
  ),
};

function Rename({ dark }: { dark?: boolean }) {
  return (
    <Screen dark={dark}>
      <div>
        <DialogTrigger defaultOpen>
          <Button>Rename…</Button>
          <DialogContent>
            {({ close }) => (
              <>
                <DialogClose />
                <DialogHeader>
                  <DialogTitle>Rename project</DialogTitle>
                  <DialogDescription>Project names are visible to everyone in the workspace.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <TextField defaultValue="Aurora redesign" autoFocus>
                    <Label variant="field">Name</Label>
                    <Input />
                  </TextField>
                </DialogBody>
                <DialogFooter>
                  <Button variant="secondary" onPress={close}>Cancel</Button>
                  <Button onPress={close}>Save</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </DialogTrigger>
      </div>
    </Screen>
  );
}

export const DefaultOpen: Story = { render: () => <Rename /> };
export const DefaultDark: Story = { render: () => <Rename dark /> };
export const Closed: Story = { render: () => <Screen h={260}><div><Alert open={false} /></div></Screen> };

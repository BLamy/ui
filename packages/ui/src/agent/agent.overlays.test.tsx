// @vitest-environment happy-dom
import { useState } from 'react';
import { cleanup, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Dialog, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetBackdrop, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ToastRegion, createToaster } from '@/components/ui/toast';
import { actOn, entry, expectNamed, mount, onPage, run, settle } from '../../test/agent-harness';

afterEach(cleanup);

// One bridge per file. Steps on a `data-agent-confirm` control ask `allow`, which a test flips to say yes or no.
let approve = false;
const agent = createAgent({ allow: (step) => !step.confirm || approve });

type Details = { source?: string; returnValue?: unknown };
const spy = () => vi.fn<(open: boolean, details: Details) => void>();
/** The popup entry (not the trigger's own Button) named `label`. */
const popup = (component: string, label: string) => {
  const found = onPage(agent.snapshot()).find((e) => e.component === component && e.label === label);
  expect(found, `no ${component} named ${label}`).toBeTruthy();
  return found!;
};

describe('Dialog is agent-ready', () => {
  function Rename({ onOpenChange }: { onOpenChange: (open: boolean, d: Details) => void }) {
    const [name, setName] = useState('Aurora');
    const [draft, setDraft] = useState(name);
    return (
      <div>
        <p>Project: {name}</p>
        <Dialog onOpenChange={onOpenChange}>
          <DialogTrigger className={buttonVariants({ variant: 'secondary' })}>Rename…</DialogTrigger>
          <DialogBackdrop />
          <DialogContent>
            <DialogClose />
            <DialogHeader><DialogTitle>Rename project</DialogTitle></DialogHeader>
            <DialogBody>
              <Field>
                <FieldLabel>New name</FieldLabel>
                <Input value={draft} onValueChange={setDraft} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button />} value="save" action={() => setName(draft)}>Save name</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  it('opens, takes a value inside, and saves through its own button', async () => {
    const onOpenChange = spy();
    await mount(<Rename onOpenChange={onOpenChange} />);
    const dialog = popup('dialog', 'Rename…');
    expect(dialog).toMatchObject({ open: false, actions: ['setOpen', 'press'] });

    const opened = await run(agent, [{ ref: dialog.ref, action: 'setOpen', args: [true] }]);
    // Open, it is named by its title and lists what it holds.
    expect(opened.open?.[0]).toMatchObject({ label: 'Rename project', buttons: ['Close', 'Save name'] });
    expectNamed(agent.snapshot(), ['Rename project', 'New name', 'Save name']);

    await run(agent, [
      { ref: 'New name', action: 'setValue', args: ['Atlas'] },
      { ref: 'Rename project', action: 'press', args: ['Save name'] },
    ]);
    expect(screen.getByText('Project: Atlas')).toBeTruthy();
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ source: 'agent' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ source: 'agent' }));
  });

  it('opens by its trigger’s name with setOpen (only the dialog takes it)', async () => {
    await mount(<Rename onOpenChange={spy()} />);
    await run(agent, [{ ref: 'Rename…', action: 'setOpen', args: [true] }]);
    expect(popup('dialog', 'Rename project').open).toBe(true);
  });

  // A trigger rendered as our Button registers twice (a `button` and the `dialog`, same label, both take `press`), so a press by name is ambiguous.
  it('presses a button inside by the trigger’s name', async () => {
    await mount(<Rename onOpenChange={spy()} />);
    await run(agent, [{ ref: 'Rename…', action: 'press', args: ['Save name'] }]);
  });
});

describe('AlertDialog is agent-ready (confirm flow)', () => {
  function DeleteProject({ onDelete, onOpenChange }: { onDelete: () => void; onOpenChange: (open: boolean, d: Details) => void }) {
    return (
      <AlertDialog onOpenChange={(open, details) => { onOpenChange(open, details); if (!open && details.returnValue === 'delete') onDelete(); }}>
        <AlertDialogTrigger className={buttonVariants({ variant: 'destructive' })}>Delete project</AlertDialogTrigger>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
            <AlertDialogClose tone="destructive" value="delete" data-agent-confirm="Deletes the project and all its files">Delete forever</AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  it('asks the person before the confirming press, and runs it once they agree', async () => {
    const onDelete = vi.fn();
    const onOpenChange = spy();
    await mount(<DeleteProject onDelete={onDelete} onOpenChange={onOpenChange} />);
    const alert = popup('alert-dialog', 'Delete project');
    const remove = [{ ref: alert.ref, action: 'press', args: ['Delete forever'] }];

    approve = false;
    const refused = await actOn(agent, remove);
    expect(refused.ok).toBe(false);
    expect(refused.error?.message).toContain('Deletes the project and all its files');
    expect(onDelete).not.toHaveBeenCalled();
    // A refused press closes the dialog it opened.
    expect(popup('alert-dialog', 'Delete project').open).toBe(false);

    approve = true;
    await run(agent, remove);
    approve = false;
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ source: 'agent', returnValue: 'delete' }));
  });

  it('cancels without asking', async () => {
    const onDelete = vi.fn();
    await mount(<DeleteProject onDelete={onDelete} onOpenChange={spy()} />);
    await run(agent, [{ ref: popup('alert-dialog', 'Delete project').ref, action: 'press', args: ['Cancel'] }]);
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('Sheet and Popover are agent-ready', () => {
  it('a sheet opens and runs its closing action', async () => {
    const paid = vi.fn();
    const onOpenChange = spy();
    await mount(
      <Sheet onOpenChange={onOpenChange}>
        <SheetTrigger className={buttonVariants()}>Upgrade plan</SheetTrigger>
        <SheetBackdrop />
        <SheetContent>
          <SheetClose />
          <SheetHeader><SheetTitle>Choose a plan</SheetTitle></SheetHeader>
          <SheetClose render={<Button />} action={paid}>Confirm and pay</SheetClose>
        </SheetContent>
      </Sheet>,
    );
    const sheet = popup('drawer', 'Upgrade plan');
    expect(sheet.actions).toEqual(expect.arrayContaining(['setOpen', 'press']));
    await run(agent, [{ ref: sheet.ref, action: 'press', args: ['Confirm and pay'] }]);
    expect(paid).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ source: 'agent' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ source: 'agent' }));
  });

  it('a popover opens and presses a button inside', async () => {
    const download = vi.fn();
    const onOpenChange = spy();
    await mount(
      <Popover onOpenChange={onOpenChange}>
        <PopoverTrigger className={buttonVariants({ variant: 'secondary' })}>Export</PopoverTrigger>
        <PopoverContent aria-label="Export options"><Button onClick={download}>Download CSV</Button></PopoverContent>
      </Popover>,
    );
    const result = await run(agent, [{ ref: popup('popover', 'Export').ref, action: 'press', args: ['Download CSV'] }]);
    expect(download).toHaveBeenCalledTimes(1);
    expect(result.open?.[0]).toMatchObject({ component: 'popover', open: true, buttons: ['Download CSV'] });
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ source: 'agent' }));
    await run(agent, [{ ref: result.open?.[0]?.ref ?? '', action: 'setOpen', args: [false] }]);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ source: 'agent' }));
  });
});

describe('Toast is agent-ready', () => {
  function Messages({ onUndo }: { onUndo: () => void }) {
    const [toaster] = useState(() => createToaster());
    return (
      <div>
        <Button onClick={() => toaster('Message sent', { description: 'Delivered to Amelia.', action: { label: 'Undo', onAction: onUndo } })}>Send message</Button>
        <ToastRegion toaster={toaster} />
      </div>
    );
  }

  it('a toast an agent caused shows up named by its title, with its text', async () => {
    await mount(<Messages onUndo={vi.fn()} />);
    await run(agent, [{ ref: 'Send message', action: 'press' }]);
    await settle(20);
    expect(entry(agent.snapshot(), 'Message sent')).toMatchObject({ component: 'toast', text: ['Message sent', 'Delivered to Amelia.'] });
  });

  // While the region is empty the bridge lists a `toast` entry with no label (agent-ready.md: mark it data-agent-hidden while empty).
  it('an empty toast region leaves no unnamed entry', async () => {
    await mount(<Messages onUndo={vi.fn()} />);
    expectNamed(agent.snapshot(), ['Send message']);
  });

  // The toast primitive offers only `pause`: its action and close buttons can't be pressed ("toast cN has nothing to press now").
  it.fails('presses a toast’s action', async () => {
    const onUndo = vi.fn();
    await mount(<Messages onUndo={onUndo} />);
    await run(agent, [{ ref: 'Send message', action: 'press' }]);
    await settle(20);
    await run(agent, [{ ref: 'Message sent', action: 'press', args: ['Undo'] }]);
    expect(onUndo).toHaveBeenCalled();
  });
});

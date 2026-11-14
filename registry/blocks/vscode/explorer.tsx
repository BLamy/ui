'use client';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tree, type TreeNode } from '@/components/ui/tree';
import { Icon } from '@/lib/icon';
import { basename, isValidName } from './files';
import type { VSCodeStore } from './store';

export function SidebarHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 ps-4 pe-1.5">
      <h2 className="m-0 min-w-0 flex-1 truncate text-caption2 font-semibold tracking-[.06em] text-muted-foreground uppercase">{title}</h2>
      {children}
    </div>
  );
}

export function SidebarAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <Button variant="quiet" size="icon-sm" aria-label={label} title={label} onClick={onClick}>
      <Icon name={icon} size={15} />
    </Button>
  );
}

/** Names a new folder. */
function FolderName({ store }: { store: VSCodeStore }) {
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        setProblem(store.commitFolderName(value));
      }}
    >
      <DialogBody>
        <Field invalid={problem ? true : undefined}>
          <FieldLabel>Name</FieldLabel>
          <Input size="sm" autoFocus value={value} onValueChange={(next) => { setValue(next); setProblem(null); }} />
          <FieldError>{problem}</FieldError>
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="quiet" />}>Cancel</DialogClose>
        <Button type="submit">Create</Button>
      </DialogFooter>
    </form>
  );
}

/** The project's files. New, rename and delete all go to the runtime, through the store. */
export function Explorer({ store }: { store: VSCodeStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const nodes = store.tree();
  const renaming = store.renaming?.path ?? null;

  const menu = (node: TreeNode) => {
    const isFolder = !!node.children;
    return (
      <DropdownMenuContent aria-label={`Actions for ${node.label}`}>
        {isFolder ? <DropdownMenuItem onSelect={() => store.beginNewFile(node.value)}>New File</DropdownMenuItem> : <DropdownMenuItem onSelect={() => store.openFile(node.value)}>Open</DropdownMenuItem>}
        {isFolder ? <DropdownMenuItem onSelect={() => store.beginNewFolder(node.value)}>New Folder</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => store.beginRename(node.value)}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => store.confirmDelete(node.value)}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    );
  };

  return (
    <div data-slot="vscode-explorer" className="flex h-full min-h-0 flex-col">
      <SidebarHeader title={basename(store.root)}>
        <SidebarAction icon="doc" label="New File" onClick={() => store.beginNewFile()} />
        <SidebarAction icon="folder-badge-plus" label="New Folder" onClick={() => store.beginNewFolder()} />
      </SidebarHeader>
      {/* Arrows move the selection; a press or Return opens a file (`onAction`). */}
      <Tree
        aria-label="Files"
        className="min-h-0 flex-1"
        items={nodes}
        sort
        density="compact"
        autoExpand={store.foldersToShow()}
        value={store.selectedPath && store.exists(store.selectedPath) ? store.selectedPath : null}
        onValueChange={(value) => store.setSelected(value)}
        onAction={(value) => { if (!store.isFolder(value)) store.openFile(value); }}
        contextMenu={menu}
        editing={renaming}
        onEditingChange={(editing, details) => {
          if (editing === null) store.endRename(details.reason === 'escape-key');
          else if (editing !== renaming) store.beginRename(editing);
        }}
        onRename={(node, label) => isValidName(label) && store.commitRename(node.value, label)}
      />
    </div>
  );
}

/** What the Explorer asks, over the whole window. */
export function ExplorerDialogs({ store }: { store: VSCodeStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const deleting = store.deleting;
  // A tray in a narrow window, a card otherwise: the Dialog's `"auto"`, from the window's size-class scope.
  return (
    <>
    <Dialog open={!!store.naming} onOpenChange={(open) => { if (!open) store.endFolderName(); }}>
      <DialogBackdrop />
      <DialogContent variant="tray">
        <DialogHeader variant="bar">
          <DialogTitle>New folder</DialogTitle>
          <DialogClose />
        </DialogHeader>
        {store.naming ? <FolderName store={store} /> : null}
      </DialogContent>
    </Dialog>
    <Dialog open={!!deleting} onOpenChange={(open) => { if (!open) store.confirmDelete(null); }}>
      <DialogBackdrop />
      <DialogContent variant="tray">
        <DialogHeader variant="bar">
          <DialogTitle>{deleting ? `Delete ${basename(deleting)}?` : null}</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            {deleting && store.isFolder(deleting) ? 'This folder and everything in it will be deleted.' : 'This file will be deleted.'} It can't be restored.
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="quiet" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              if (deleting) store.deletePath(deleting);
              store.confirmDelete(null);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

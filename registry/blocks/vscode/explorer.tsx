'use client';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Credenza, CredenzaBackdrop, CredenzaClose, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza';
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
      className="flex flex-col gap-3 px-3.5 pt-1 pb-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        setProblem(store.commitFolderName(value));
      }}
    >
      <Field invalid={problem ? true : undefined}>
        <FieldLabel variant="field">Name</FieldLabel>
        <Input size="sm" autoFocus value={value} onValueChange={(next) => { setValue(next); setProblem(null); }} />
        <FieldError>{problem}</FieldError>
      </Field>
      <div className="flex justify-end gap-2">
        <CredenzaClose render={<Button variant="quiet" />}>Cancel</CredenzaClose>
        <Button type="submit">Create</Button>
      </div>
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
      <ContextMenuContent aria-label={`Actions for ${node.label}`}>
        {isFolder ? <ContextMenuItem onSelect={() => store.beginNewFile(node.value)}>New File</ContextMenuItem> : <ContextMenuItem onSelect={() => store.openFile(node.value)}>Open</ContextMenuItem>}
        {isFolder ? <ContextMenuItem onSelect={() => store.beginNewFolder(node.value)}>New Folder</ContextMenuItem> : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => store.beginRename(node.value)}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={() => store.confirmDelete(node.value)}>Delete</ContextMenuItem>
      </ContextMenuContent>
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
  // A tray in a narrow window, a card otherwise: Credenza's `auto`, from the window's size-class scope.
  return (
    <>
    <Credenza open={!!store.naming} onOpenChange={(open) => { if (!open) store.endFolderName(); }}>
      <CredenzaBackdrop />
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>New folder</CredenzaTitle>
          <CredenzaClose />
        </CredenzaHeader>
        {store.naming ? <FolderName store={store} /> : null}
      </CredenzaContent>
    </Credenza>
    <Credenza open={!!deleting} onOpenChange={(open) => { if (!open) store.confirmDelete(null); }}>
      <CredenzaBackdrop />
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{deleting ? `Delete ${basename(deleting)}?` : null}</CredenzaTitle>
          <CredenzaClose />
        </CredenzaHeader>
        <div className="flex flex-col gap-3 px-3.5 pt-1 pb-3.5">
          <p className="m-0 text-footnote text-muted-foreground">
            {deleting && store.isFolder(deleting) ? 'This folder and everything in it will be deleted.' : 'This file will be deleted.'} It can't be restored.
          </p>
          <div className="flex justify-end gap-2">
            <CredenzaClose render={<Button variant="quiet" />}>Cancel</CredenzaClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) store.deletePath(deleting);
                store.confirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </CredenzaContent>
    </Credenza>
    </>
  );
}

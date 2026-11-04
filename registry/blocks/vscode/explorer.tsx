'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Credenza } from '@/components/ui/credenza';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, TextField } from '@/components/ui/text-field';
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

export function SidebarAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Button variant="quiet" size="icon-sm" aria-label={label} title={label} onPress={onPress}>
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
      <TextField value={value} onChange={(next) => { setValue(next); setProblem(null); }} isInvalid={!!problem}>
        <Label variant="field">Name</Label>
        <Input size="sm" data-autofocus />
        <FieldError>{problem}</FieldError>
      </TextField>
      <div className="flex justify-end gap-2">
        <Button variant="quiet" onPress={() => store.endFolderName()}>Cancel</Button>
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
  // Selection from a click opens the file. The arrow keys only move the selection, and Return opens it (`onAction`).
  const pressed = useRef(false);
  const escaped = useRef(false);

  const menu = (node: TreeNode) => {
    const isFolder = !!node.children;
    return (
      <ContextMenuContent aria-label={`Actions for ${node.name}`}>
        {isFolder ? <ContextMenuItem onAction={() => store.beginNewFile(node.id)}>New File</ContextMenuItem> : <ContextMenuItem onAction={() => store.openFile(node.id)}>Open</ContextMenuItem>}
        {isFolder ? <ContextMenuItem onAction={() => store.beginNewFolder(node.id)}>New Folder</ContextMenuItem> : null}
        <ContextMenuSeparator />
        <ContextMenuItem onAction={() => store.beginRename(node.id)}>Rename</ContextMenuItem>
        <ContextMenuItem onAction={() => store.confirmDelete(node.id)}>Delete</ContextMenuItem>
      </ContextMenuContent>
    );
  };

  return (
    <div data-slot="vscode-explorer" className="flex h-full min-h-0 flex-col">
      <SidebarHeader title={basename(store.root)}>
        <SidebarAction icon="doc" label="New File" onPress={() => store.beginNewFile()} />
        <SidebarAction icon="folder-badge-plus" label="New Folder" onPress={() => store.beginNewFolder()} />
      </SidebarHeader>
      <div
        className="flex min-h-0 flex-1 flex-col"
        onPointerDownCapture={() => { pressed.current = true; }}
        onKeyDownCapture={(event) => { if (event.key === 'Escape') escaped.current = true; }}
      >
        <Tree
          aria-label="Files"
          className="min-h-0 flex-1"
          items={nodes}
          sort
          density="compact"
          expandedIds={store.foldersToShow()}
          selectedIds={store.selectedPath && store.exists(store.selectedPath) ? [store.selectedPath] : []}
          onSelectionChange={([id]) => {
            const wasPress = pressed.current;
            pressed.current = false;
            store.setSelected(id ?? null);
            if (wasPress && id && !store.isFolder(id)) store.openFile(id);
          }}
          onAction={(node) => { if (!node.children) store.openFile(node.id); }}
          contextMenu={menu}
          renamingId={renaming}
          onRename={(node, name) => {
            if (isValidName(name)) store.commitRename(node.id, name);
          }}
          onRenameEnd={() => {
            const cancelled = escaped.current;
            escaped.current = false;
            store.endRename(cancelled);
          }}
        />
      </div>
    </div>
  );
}

/** What the Explorer asks, over the whole window. */
export function ExplorerDialogs({ store }: { store: VSCodeStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const deleting = store.deleting;
  return (
    <>
    <Credenza open={!!store.naming} onClose={() => store.endFolderName()} title="New folder">
      {store.naming ? <FolderName store={store} /> : null}
    </Credenza>
    <Credenza open={!!deleting} onClose={() => store.confirmDelete(null)} title={deleting ? `Delete ${basename(deleting)}?` : undefined}>
      <div className="flex flex-col gap-3 px-3.5 pt-1 pb-3.5">
        <p className="m-0 text-footnote text-muted-foreground">
          {deleting && store.isFolder(deleting) ? 'This folder and everything in it will be deleted.' : 'This file will be deleted.'} It can't be restored.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onPress={() => store.confirmDelete(null)}>Cancel</Button>
          <Button
            variant="destructive"
            onPress={() => {
              if (deleting) store.deletePath(deleting);
              store.confirmDelete(null);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </Credenza>
    </>
  );
}

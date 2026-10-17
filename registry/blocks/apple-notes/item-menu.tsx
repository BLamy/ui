/* Everything in Notes has the same actions wherever you reach it: right-click a sidebar location, a folder or
   note row, a tree item, or use the note's … button. Rename edits the name in place; Delete asks first. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ContextMenu, ContextMenuContent } from '@/components/ui/context-menu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { ROOT_FOLDER } from './data';
import type { NotesState, RenamePlace } from './use-notes';

interface Action { id: string; label: string; icon?: string; destructive?: boolean; disabled?: boolean }
type Entry = Action | 'separator';

/** The actions for a note or folder id, in menu order. */
function actionsFor(notes: NotesState, id: string): Entry[] {
  const busy = notes.files.busy;
  const n = notes.notes.find((item) => item.id === id);
  if (n) {
    const draft = notes.drafts[id];
    if (n.file.standalone) return [
      { id: 'copy-markdown', label: 'Copy Markdown', icon: 'copy' },
      ...(draft ? [{ id: 'revert', label: 'Discard My Edits', icon: 'arrow-clockwise', disabled: !!draft.saving }] : []),
      'separator', { id: 'close', label: 'Close File', icon: 'xmark', disabled: !!draft },
    ];
    return [
      { id: 'rename', label: 'Rename…', icon: 'pencil', disabled: busy },
      { id: 'duplicate', label: 'Duplicate', icon: 'copy', disabled: busy },
      { id: 'copy-path', label: 'Copy Path', icon: 'link' },
      ...(draft ? [{ id: 'revert', label: 'Discard My Edits', icon: 'arrow-clockwise', disabled: !!draft.saving }] : []),
      'separator', { id: 'delete', label: 'Delete', icon: 'trash', destructive: true, disabled: busy },
    ];
  }
  const f = notes.folders.find((item) => item.id === id);
  if (!f?.path) return [];
  const create: Entry[] = [
    { id: 'new-note', label: 'New Note', icon: 'compose', disabled: f.connected === false },
    { id: 'new-folder', label: 'New Folder', icon: 'folder-badge-plus', disabled: f.connected === false },
  ];
  if (f.parent === ROOT_FOLDER.id) return f.source === 'local' ? [
    ...create, 'separator',
    ...(f.connected === false ? [{ id: 'reconnect', label: 'Reconnect Folder', icon: 'arrow-clockwise' }] : []),
    { id: 'remove', label: 'Remove from Notes', icon: 'minus-circle', disabled: busy },
  ] : create;
  return [
    ...create, 'separator',
    { id: 'rename', label: 'Rename…', icon: 'pencil', disabled: busy },
    { id: 'copy-path', label: 'Copy Path', icon: 'link' },
    'separator', { id: 'delete', label: 'Delete', icon: 'trash', destructive: true, disabled: busy },
  ];
}

function useAct(notes: NotesState, id: string, place: RenamePlace) {
  return (key: string) => {
    const n = notes.notes.find((item) => item.id === id);
    const f = notes.folders.find((item) => item.id === id);
    const path = n?.file.path ?? f?.path ?? '';
    if (key === 'rename') { notes.setCreating(null); notes.setRenaming({ id, in: place }); }
    else if (key === 'delete') notes.setDeleting(id);
    else if (key === 'duplicate') void notes.files.run(() => notes.duplicate(id));
    else if (key === 'copy-path') void navigator.clipboard?.writeText(path);
    else if (key === 'copy-markdown' && n) void navigator.clipboard?.writeText(n.body);
    else if (key === 'revert') notes.revert(id);
    else if (key === 'close' && n) { notes.files.close(n); if (notes.selectedId === id) notes.select(null); }
    else if (key === 'new-note' || key === 'new-folder') notes.startCreating(key === 'new-note' ? 'file' : 'folder', id);
    else if (key === 'reconnect') void notes.files.run(() => notes.files.reconnect(id));
    else if (key === 'remove') void notes.files.run(() => notes.removeFolder(id));
  };
}

/** The menu's items, for a ContextMenuContent or a DropdownMenuContent. */
export function itemMenuItems(notes: NotesState, id: string) {
  return actionsFor(notes, id).map((entry, index) => entry === 'separator'
    ? <DropdownMenuSeparator key={`separator-${index}`} />
    : <DropdownMenuItem key={entry.id} id={entry.id} isDisabled={entry.disabled} variant={entry.destructive ? 'destructive' : undefined}
      icon={entry.icon ? <Icon name={entry.icon} size={20} /> : undefined}>{entry.label}</DropdownMenuItem>);
}

/** The menu's action handler, for a dropdown that shows `itemMenuItems`. */
export function useItemMenuAction(notes: NotesState, id: string, place: RenamePlace = 'list') {
  const act = useAct(notes, id, place);
  return (key: string | number) => act(String(key));
}

/** The item's right-click menu, for a ContextMenu (or a Tree's `contextMenu`). */
export function ItemMenuContent({ notes, id, label, place }: { notes: NotesState; id: string; label: string; place?: RenamePlace }) {
  const act = useItemMenuAction(notes, id, place);
  return <ContextMenuContent aria-label={`${label} actions`} onAction={act}>{itemMenuItems(notes, id)}</ContextMenuContent>;
}

export const hasItemMenu = (notes: NotesState, id: string) => actionsFor(notes, id).length > 0;

/** Right-click (or long-press, or the menu key) on `children` for the item's actions. */
export function ItemMenu({ notes, id, label, children, className }: { notes: NotesState; id: string; label: string; children: ReactNode; className?: string }) {
  const empty = !hasItemMenu(notes, id);
  return <ContextMenu isDisabled={empty} className={className}>
    {children}
    {empty ? null : <ItemMenuContent notes={notes} id={id} label={label} />}
  </ContextMenu>;
}

/** The name, edited in place: Return keeps it, Escape (or an unchanged name) leaves it as it was. The stem is
    selected so the extension survives typing. */
export function RenameField({ notes, id, name, className }: { notes: NotesState; id: string; name: string; className?: string }) {
  const [value, setValue] = useState(name);
  const done = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  // The menu that started the rename hands focus back to where it opened as it closes, after this field has
  // mounted: take it back for that first moment rather than treating it as the user leaving.
  const opened = useRef(0);
  const focus = () => {
    const el = input.current;
    if (!el || done.current) return;
    el.focus(); el.setSelectionRange(0, /\.mdx?$/i.exec(name)?.index ?? name.length);
  };
  useEffect(() => {
    opened.current = performance.now();
    const frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    notes.setRenaming(null);
    const next = value.trim();
    if (keep && next && next !== name) void notes.files.run(() => notes.rename(id, next));
  };
  const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
  return <input ref={input} aria-label={`Rename ${name}`} value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off"
    onChange={(e) => setValue(e.target.value)}
    onBlur={() => { if (performance.now() - opened.current < 400) requestAnimationFrame(focus); else finish(true); }}
    onKeyDown={(e) => {
      stop(e);
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    }}
    onKeyUp={stop} onPointerDown={stop} onMouseDown={stop} onClick={stop} onDoubleClick={stop}
    className={cn('min-w-0 flex-1 rounded-[5px] border-0 bg-background px-1.5 py-0.5 text-inherit text-foreground outline-none ring-2 ring-ring', className)} />;
}

import { useMemo, useState } from 'react';
import { Collection, isFileDropItem, useDragAndDrop, type DropItem, type Key } from 'react-aria-components';
import { Tree, TreeFileIcon, TreeFolderIcon, TreeItem } from '@/components/ui/tree';
import { title, type Folder, type Note } from './data';
import { hasItemMenu, ItemMenuContent, RenameField } from './item-menu';
import type { NotesState, OtherFile } from './use-notes';
import { UnreadDot } from './parts';
import { NOTES_FILE } from './drag';
import { Icon } from '@/lib/icon';

interface Node { id: string; label: string; folder?: Folder; note?: Note; other?: OtherFile; children?: Node[] }

/** The location as a file tree: the library's Tree, with each item's Notes menu and in-place rename. Files drag out
    (onto a note to embed, onto another location to move or copy); files from your computer drop into a folder. */
export function FolderTree({ notes, root, onOpen }: { notes: NotesState; root: Folder; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Set<Key>>(() => new Set([...notes.trail.map((f) => f.id), ...(notes.selected ? [notes.selected.folder] : [])]));
  const nodes = useMemo(() => {
    const q = notes.query.trim().toLowerCase();
    const leaves = (parent: string): Node[] => notes.filter === 'stl' ? [] : notes.notes.filter((n) => n.folder === parent && (!q || `${title(n)}\n${n.body}`.toLowerCase().includes(q)))
      .sort((a, b) => title(a).localeCompare(title(b)))
      .map((n) => ({ id: n.id, label: title(n), note: n }));
    // Models open in the viewer; under All Files, everything else is listed beside them, dimmed.
    const rest = (parent: string): Node[] => notes.others
      .filter((o) => notes.listed(o) && o.folder === parent && (!q || o.name.toLowerCase().includes(q)))
      .map((o) => ({ id: o.id, label: o.name, other: o }));
    const sorted = (items: Node[]) => items.sort((a, b) => a.label.localeCompare(b.label));
    const build = (parent: string): Node[] => [...notes.folders
      .filter((f) => f.parent === parent && notes.shown(f))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((f) => ({ id: f.id, label: f.title, folder: f, children: build(f.id) })), ...sorted([...leaves(parent), ...rest(parent)])];
    return build(root.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shown` follows the filter and the folders.
  }, [notes.folders, notes.notes, notes.others, notes.filter, notes.query, root.id]);
  const index = new Map<string, Node>();
  const visit = (n: Node) => { index.set(n.id, n); n.children?.forEach(visit); };
  nodes.forEach(visit);
  const upload = (folder: Folder | undefined, items: DropItem[]) => {
    if (!folder?.path) return;
    const path = folder.path;
    void notes.files.run(async () => notes.upload(path, await Promise.all(items.filter(isFileDropItem).map((item) => item.getFile()))));
  };
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].flatMap((key) => {
      const node = index.get(String(key));
      const path = node?.note && !node.note.file.standalone ? node.note.file.path : node?.other?.path;
      return path ? [{ [NOTES_FILE]: path, 'text/plain': path }] : [];
    }),
    getAllowedDropOperations: () => ['copy', 'move'],
    // Only files from your computer drop here, into a folder row or the location itself.
    getDropOperation: (target, types) => types.has(NOTES_FILE) || (target.type === 'item' && (target.dropPosition !== 'on' || !index.get(String(target.key))?.folder)) ? 'cancel' : 'copy',
    onRootDrop: (e) => upload(root, e.items),
    onItemDrop: (e) => upload(index.get(String(e.target.key))?.folder, e.items),
  });
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  function render(node: Node) {
    return (
      <TreeItem id={node.id} textValue={node.label}
        title={notes.isRenaming(node.id) ? <RenameField notes={notes} id={node.id} name={node.label} className="w-full" />
          : node.other && node.other.kind !== 'stl' ? <span className="opacity-60" title="Drag onto a note to embed it">{node.label}</span> : node.label}
        icon={({ isExpanded, isSelected }) => node.folder ? <TreeFolderIcon open={isExpanded} />
          : node.other?.kind === 'stl' ? <Icon name="cube" size={17} className={isSelected ? undefined : 'text-primary'} /> : <TreeFileIcon name={node.label} />}
        trailing={node.note ? <>
          {notes.files.unseen.has(node.id) ? <UnreadDot /> : null}
          {notes.drafts[node.id] ? <span aria-label="Unsaved changes" className="size-1.5 rounded-full bg-current" /> : null}
        </> : null}
        contextMenu={!node.other && hasItemMenu(notes, node.id) ? <ItemMenuContent notes={notes} id={node.id} label={node.label} /> : undefined}>
        {node.children?.length ? <Collection items={node.children}>{render}</Collection> : null}
      </TreeItem>
    );
  }

  return <Tree aria-label="Folders and files" items={nodes} dragAndDropHooks={dragAndDropHooks} expandedKeys={notes.query ? notes.folders.map((f) => f.id) : expanded} onExpandedChange={(keys) => setExpanded(new Set(keys))}
    // react-aria caches rendered rows by item; these change a row without changing its item.
    dependencies={[notes.files.unseen, notes.drafts, notes.renaming, notes.files.busy]}
    selectionMode="single" selectedKeys={notes.selectedId ? [notes.selectedId] : [notes.folderId]}
    onSelectionChange={(keys) => {
      const node = index.get(String([...keys][0]));
      if (node?.note || node?.other?.kind === 'stl') onOpen(node.id);
      else if (node?.folder) toggle(node.id);
    }}
    className="mx-2 min-h-[50vh] rounded-xl pb-16 data-[drop-target]:bg-secondary/60 data-[drop-target]:ring-2 data-[drop-target]:ring-primary data-[drop-target]:ring-inset">{render}</Tree>;
}

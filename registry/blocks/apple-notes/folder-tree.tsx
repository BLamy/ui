import { useMemo, useState } from 'react';
import { Collection, type Key } from 'react-aria-components';
import { Tree, TreeFileIcon, TreeFolderIcon, TreeItem } from '@/components/ui/tree';
import { title, type Folder, type Note } from './data';
import { hasItemMenu, ItemMenuContent, RenameField } from './item-menu';
import type { NotesState } from './use-notes';
import { UnreadDot } from './parts';

interface Node { id: string; label: string; folder?: Folder; note?: Note; children?: Node[] }

/** The location as a file tree: the library's Tree, with each item's Notes menu and in-place rename. */
export function FolderTree({ notes, root, onOpen }: { notes: NotesState; root: Folder; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Set<Key>>(() => new Set([...notes.trail.map((f) => f.id), ...(notes.selected ? [notes.selected.folder] : [])]));
  const nodes = useMemo(() => {
    const q = notes.query.trim().toLowerCase();
    const leaves = (parent: string): Node[] => notes.notes.filter((n) => n.folder === parent && (!q || `${title(n)}\n${n.body}`.toLowerCase().includes(q)))
      .sort((a, b) => title(a).localeCompare(title(b)))
      .map((n) => ({ id: n.id, label: title(n), note: n }));
    const build = (parent: string): Node[] => [...notes.folders
      .filter((f) => f.parent === parent)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((f) => ({ id: f.id, label: f.title, folder: f, children: build(f.id) })), ...leaves(parent)];
    return build(root.id);
  }, [notes.folders, notes.notes, notes.query, root.id]);
  const index = new Map<string, Node>();
  const visit = (n: Node) => { index.set(n.id, n); n.children?.forEach(visit); };
  nodes.forEach(visit);
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  function render(node: Node) {
    return (
      <TreeItem id={node.id} textValue={node.label}
        title={notes.isRenaming(node.id) ? <RenameField notes={notes} id={node.id} name={node.label} className="w-full" /> : node.label}
        icon={({ isExpanded }) => node.folder ? <TreeFolderIcon open={isExpanded} /> : <TreeFileIcon name={node.label} />}
        trailing={node.note ? <>
          {notes.files.unseen.has(node.id) ? <UnreadDot /> : null}
          {notes.drafts[node.id] ? <span aria-label="Unsaved changes" className="size-1.5 rounded-full bg-current" /> : null}
        </> : null}
        contextMenu={hasItemMenu(notes, node.id) ? <ItemMenuContent notes={notes} id={node.id} label={node.label} /> : undefined}>
        {node.children?.length ? <Collection items={node.children}>{render}</Collection> : null}
      </TreeItem>
    );
  }

  return <Tree aria-label="Folders and Markdown files" items={nodes} expandedKeys={notes.query ? notes.folders.map((f) => f.id) : expanded} onExpandedChange={(keys) => setExpanded(new Set(keys))}
    // react-aria caches rendered rows by item; these change a row without changing its item.
    dependencies={[notes.files.unseen, notes.drafts, notes.renaming, notes.files.busy]}
    selectionMode="single" selectedKeys={notes.selectedId ? [notes.selectedId] : [notes.folderId]}
    onSelectionChange={(keys) => {
      const node = index.get(String([...keys][0]));
      if (node?.note) onOpen(node.id);
      else if (node?.folder) toggle(node.id);
    }}
    className="mx-2 pb-16">{render}</Tree>;
}

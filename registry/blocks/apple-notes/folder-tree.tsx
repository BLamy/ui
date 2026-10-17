import { useMemo, useState } from 'react';
import { Tree, type TreeNode } from '@/components/ui/tree';
import { title, type Folder, type Note } from './data';
import { hasItemMenu, ItemMenuContent } from './item-menu';
import { viewable, type NotesState, type OtherFile } from './use-notes';
import { hasComputerFiles, NOTES_FILE } from './drag';

interface Node extends TreeNode { folder?: Folder; note?: Note; other?: OtherFile; children?: Node[] }

/** The location as a file tree: the library's Tree, with each item's Notes menu and in-place rename. Files drag out
    (onto a note to embed, onto another location to move or copy); files from your computer drop into a folder. */
export function FolderTree({ notes, root, onOpen }: { notes: NotesState; root: Folder; onOpen: (id: string) => void }) {
  const [opened] = useState(() => [...notes.trail.map((f) => f.id), ...(notes.selected ? [notes.selected.folder] : [])]);
  const nodes = useMemo(() => {
    const q = notes.query.trim().toLowerCase();
    const leaves = (parent: string): Node[] => notes.filter !== 'all' && notes.filter !== 'markdown' ? [] : notes.notes.filter((n) => n.folder === parent && (!q || `${title(n)}\n${n.body}`.toLowerCase().includes(q)))
      .map((n) => {
        const marks = [notes.files.unseen.has(n.id) ? 'Changed outside Notes' : '', notes.drafts[n.id] ? 'Unsaved changes' : ''].filter(Boolean);
        return { id: n.id, name: title(n), note: n, icon: 'doc' as const, ...(marks.length ? { detail: '•', detailTitle: marks.join(', ') } : {}) };
      });
    // Models, images and data files open in their viewers; under All Files, everything else is listed beside them, dimmed.
    const rest = (parent: string): Node[] => notes.others
      .filter((o) => notes.listed(o) && o.folder === parent && (!q || o.name.toLowerCase().includes(q)))
      .map((o) => ({ id: o.id, name: o.name, other: o, ...(o.kind === 'stl' ? { icon: 'cube' as const } : o.kind === 'image' ? { icon: 'photo' as const }
        : viewable(o.kind) ? {} : { dimmed: true, detailTitle: 'Drag onto a note to embed it' }) }));
    const sorted = (items: Node[]) => items.sort((a, b) => a.name.localeCompare(b.name));
    const build = (parent: string): Node[] => [...notes.folders
      .filter((f) => f.parent === parent && notes.shown(f))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((f) => ({ id: f.id, name: f.title, folder: f, children: build(f.id) })), ...sorted([...leaves(parent), ...rest(parent)])];
    return build(root.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shown` follows the filter and the folders.
  }, [notes.folders, notes.notes, notes.others, notes.filter, notes.query, notes.files.unseen, notes.drafts, root.id]);
  const pathOf = (node: Node) => (node.note && !node.note.file.standalone ? node.note.file.path : node.other?.path);
  const upload = (folder: Folder | undefined, files: File[]) => {
    if (!folder?.path || !files.length) return;
    const path = folder.path;
    void notes.files.run(() => notes.upload(path, files));
  };
  const renaming = notes.renaming?.in === 'tree' ? notes.renaming.id : null;

  return <Tree aria-label="Folders and files" items={nodes} icons="standard"
    defaultExpanded={opened}
    // While searching, every folder opens so the matches show.
    expandedIds={notes.query ? notes.folders.map((f) => f.id) : undefined}
    selectedIds={[notes.selectedId ?? notes.folderId]}
    onSelectionChange={([id]) => {
      const node = find(nodes, id);
      if (node?.note || (node?.other && viewable(node.other.kind))) onOpen(node.id);
    }}
    contextMenu={(node) => {
      const n = node as Node;
      return !n.other && hasItemMenu(notes, n.id) ? <ItemMenuContent notes={notes} id={n.id} label={n.name} place="tree" /> : null;
    }}
    renamingId={renaming}
    onRename={(node, name) => { void notes.files.run(() => notes.rename(node.id, name)); }}
    onRenameEnd={() => { if (notes.renaming?.in === 'tree') notes.setRenaming(null); }}
    // Files drag out as their paths: a note embeds them, another location moves or copies them.
    canDrag={(list) => list.every((n) => !!pathOf(n as Node))}
    onDragStart={(list, data) => {
      const paths = list.flatMap((n) => pathOf(n as Node) ?? []).join('\n');
      data.setData(NOTES_FILE, paths);
      data.setData('text/plain', paths);
      data.effectAllowed = 'copyMove';
    }}
    // Files from your computer drop into a folder (a file's row stands for its folder), or the location itself.
    externalDrop={{
      accepts: (types) => types.includes('Files') && !types.includes(NOTES_FILE),
      onDrop: (data, target) => { if (hasComputerFiles(data)) upload((target as Node | null)?.folder ?? root, [...data.files]); },
    }}
    className="mx-2 h-[60vh] min-h-64 pb-4" />;
}

function find(nodes: readonly Node[], id: string | undefined): Node | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const inner = n.children && find(n.children, id);
    if (inner) return inner;
  }
  return undefined;
}

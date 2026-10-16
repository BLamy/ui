import { useMemo, useState } from 'react';
import { Button, Collection, Tree, TreeItem, TreeItemContent, type Key } from 'react-aria-components';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { ROOT_FOLDER, title, type Folder, type Note } from './data';
import type { NotesState } from './use-notes';
import { UnreadDot } from './parts';

interface Node { id: string; label: string; folder?: Folder; note?: Note; children?: Node[] }

/** React Aria provides roving focus, typeahead and the standard arrow-key tree navigation. */
export function FolderTree({ notes, onOpen }: { notes: NotesState; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Set<Key>>(() => new Set([...notes.trail.map((f) => f.id), ...(notes.selected ? [notes.selected.folder] : [])]));
  const nodes = useMemo(() => {
    const q = notes.query.trim().toLowerCase();
    const build = (parent: string): Node[] => notes.folders
      .filter((f) => f.parent === parent && (parent !== ROOT_FOLDER.id || f.source === 'local' || notes.notes.some((n) => n.file.path.startsWith(`${f.path}/`))))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((f) => ({ id: f.id, label: f.title, folder: f,
        children: [...build(f.id), ...notes.notes.filter((n) => n.folder === f.id && (!q || `${title(n)}\n${n.body}`.toLowerCase().includes(q)))
          .sort((a, b) => title(a).localeCompare(title(b)))
          .map((n) => ({ id: n.id, label: title(n), note: n }))] }));
    return build(ROOT_FOLDER.id);
  }, [notes.folders, notes.notes, notes.query]);
  const index = new Map<string, Node>();
  const visit = (n: Node) => { index.set(n.id, n); n.children?.forEach(visit); };
  nodes.forEach(visit);

  function render(node: Node) {
    return (
      <TreeItem id={node.id} textValue={node.label} key={node.id}
        className="cursor-default rounded-md outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-hovered:bg-secondary data-selected:bg-primary data-selected:text-primary-foreground">
        <TreeItemContent>
          {({ hasChildItems, isExpanded, level }) => (
            <div className="flex min-h-10 min-w-0 items-center gap-1 pr-2" style={{ paddingLeft: (level - 1) * 16 + 4 }}>
              {hasChildItems ? <Button slot="chevron" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.label}`}
                className="grid size-7 shrink-0 place-items-center rounded-md border-0 bg-transparent p-0 text-inherit outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring">
                <Icon name="chevron-right" size={13} className={cn(isExpanded && 'rotate-90')} />
              </Button> : <span className="w-7 shrink-0" />}
              <Icon name={node.folder ? 'folder' : 'note'} size={17} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-detail">{node.label}</span>
              {node.note && notes.files.unseen.has(node.id) ? <UnreadDot /> : null}
              {node.note && notes.drafts[node.id] ? <span aria-label="Unsaved changes" className="size-1.5 rounded-full bg-current" /> : null}
            </div>
          )}
        </TreeItemContent>
        {node.children?.length ? <Collection items={node.children}>{render}</Collection> : null}
      </TreeItem>
    );
  }

  return <Tree aria-label="Folders and Markdown files" items={nodes} expandedKeys={notes.query ? notes.folders.map((f) => f.id) : expanded} onExpandedChange={(keys) => setExpanded(new Set(keys))}
    selectionMode="single" selectedKeys={notes.selectedId ? [notes.selectedId] : [notes.folderId]}
    onSelectionChange={(keys) => {
      const key = [...keys][0];
      const node = index.get(String(key));
      if (node?.note) onOpen(node.id);
      else if (node?.folder) setExpanded((prev) => {
        const next = new Set(prev); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next;
      });
    }}
    className="mx-2 pb-16 outline-none">{render}</Tree>;
}

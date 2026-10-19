/* What the file tree and the detail share: paths as Tree nodes, and a diff's files as @pierre/diffs items (parsed
   once per diff, since both the summary's line counts and the CodeView need them). */
import { parseDiffFromFile, type CodeViewItem } from '@pierre/diffs';
import type { TreeNode } from '@/components/ui/tree';
import type { WorktreeDiff } from './types';

/** Paths as nested nodes: folders are `dir:`-prefixed, files keep their path as id. */
export function treeOf(files: { path: string; dimmed?: boolean }[]): TreeNode[] {
  type Folder = { node: TreeNode & { children: TreeNode[] }; folders: Map<string, Folder> };
  const root: Folder = { node: { id: 'dir:', name: '', children: [] }, folders: new Map() };
  for (const f of files) {
    const parts = f.path.split('/');
    let at = root;
    parts.slice(0, -1).forEach((name, i) => {
      let next = at.folders.get(name);
      if (!next) {
        next = { node: { id: `dir:${parts.slice(0, i + 1).join('/')}`, name, children: [] }, folders: new Map() };
        at.folders.set(name, next);
        at.node.children.push(next.node);
      }
      at = next;
    });
    at.node.children.push({ id: f.path, name: parts[parts.length - 1], dimmed: f.dimmed });
  }
  return root.node.children;
}

export const isFolder = (id: string) => id.startsWith('dir:');

const parsed = new WeakMap<WorktreeDiff, CodeViewItem[]>();

/** The diff's text files as CodeView items (binary and large ones are left out). */
export function diffItems(diff: WorktreeDiff, worktreeId: string): CodeViewItem[] {
  let items = parsed.get(diff);
  if (!items) {
    items = diff.files.filter((f) => !f.skipped).map((f) => ({
      id: f.path,
      type: 'diff',
      fileDiff: parseDiffFromFile(
        f.before != null ? { name: f.path, contents: f.before, cacheKey: `${worktreeId}:${f.path}:before` } : null,
        f.after != null ? { name: f.path, contents: f.after, cacheKey: `${worktreeId}:${f.path}:after` } : null,
      ),
    }));
    parsed.set(diff, items);
  }
  return items;
}

export function lineCounts(items: CodeViewItem[]) {
  let added = 0, removed = 0;
  for (const item of items) {
    if (item.type !== 'diff') continue;
    for (const h of item.fileDiff.hunks) { added += h.additionLines; removed += h.deletionLines; }
  }
  return { added, removed };
}

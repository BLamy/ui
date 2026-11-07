import type { TreeNode } from '@/components/ui/tree';
import type { SourceEntry } from './host';

/** Keep origins distinct, and keep queries and fragments on the leaf. */
export function sourcePath(source: SourceEntry): string[] {
  const name = source.url || source.id;
  const url = /^([a-z][a-z\d+.-]*:\/\/[^/]*)(?:\/|$)(.*)$/i.exec(name);
  const path = url ? url[2] : name;
  const suffixAt = path.search(/[?#]/);
  const parts = (suffixAt < 0 ? path : path.slice(0, suffixAt)).split(/[\\/]/);
  if (suffixAt >= 0) parts[parts.length - 1] += path.slice(suffixAt);
  if (url) parts.unshift(url[1]);
  return parts.filter(Boolean);
}

export interface SourceTree {
  items: TreeNode[];
  paths: Map<string, { id: string; name: string }[]>;
  sources: Map<string, SourceEntry>;
}

/** A source's identity is its recording id, even when several sources have the same URL. */
export function sourceTree(own: SourceEntry[], rest: SourceEntry[]): SourceTree {
  const tree: SourceTree = { items: [], paths: new Map(), sources: new Map() };
  const folders = new Map<string, TreeNode>();
  const add = (source: SourceEntry, group: string, roots: TreeNode[], prefix: { id: string; name: string }[] = []) => {
    const parts = sourcePath(source);
    let children = roots;
    const trail = [...prefix];
    for (let i = 0; i < parts.length - 1; i++) {
      const id = `directory:${JSON.stringify([group, ...parts.slice(0, i + 1)])}`;
      let folder = folders.get(id);
      if (!folder) {
        folder = { id, name: parts[i], children: [] };
        folders.set(id, folder);
        children.push(folder);
      }
      trail.push({ id, name: folder.name });
      children = folder.children as TreeNode[];
    }
    const id = `source:${source.id}`;
    const name = parts.at(-1) || source.id;
    children.push({ id, name });
    trail.push({ id, name });
    tree.paths.set(source.id, trail);
    tree.sources.set(id, source);
  };
  own.forEach((source) => add(source, 'app', tree.items));
  if (rest.length) {
    const group = { id: 'framework', name: `Framework and generated code (${rest.length})` };
    const children: TreeNode[] = [];
    tree.items.push({ ...group, children });
    rest.forEach((source) => add(source, 'framework', children, [group]));
  }
  return tree;
}

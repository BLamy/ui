import { useState } from 'react'
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { Tree, type TreeNode } from '@/components/ui/tree'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

const dir = (path: string, children: TreeNode[]): TreeNode => ({ id: path, name: path.split('/').pop()!, children })
const file = (path: string): TreeNode => ({ id: path, name: path.split('/').pop()! })

const PROJECT: TreeNode[] = [
  dir('apps', [
    dir('apps/docs', [
      dir('apps/docs/pages', [file('apps/docs/pages/introduction.md'), file('apps/docs/pages/tree.mdx')]),
      file('apps/docs/vite.config.mts'),
    ]),
  ]),
  dir('packages', [
    dir('packages/ui', [
      dir('packages/ui/src', [
        dir('packages/ui/src/components', [
          file('packages/ui/src/components/button.tsx'),
          file('packages/ui/src/components/tree.tsx'),
          file('packages/ui/src/components/list-box.tsx'),
        ]),
        file('packages/ui/src/index.ts'),
        file('packages/ui/src/styles.css'),
      ]),
      file('packages/ui/package.json'),
    ]),
  ]),
  file('README.md'),
  file('logo.svg'),
  file('nx.json'),
]

const GIT = {
  'apps/docs/pages/tree.mdx': 'added',
  'packages/ui/src/components/tree.tsx': 'added',
  'packages/ui/src/components/list-box.tsx': 'modified',
  'packages/ui/src/index.ts': 'modified',
} as const

const prune = (list: TreeNode[], id: string): TreeNode[] =>
  list.filter((n) => n.id !== id).map((n) => (n.children ? { ...n, children: prune([...n.children], id) } : n))
const renamed = (list: TreeNode[], id: string, name: string): TreeNode[] =>
  list.map((n) => (n.id === id ? { ...n, name } : n.children ? { ...n, children: renamed([...n.children], id, name) } : n))

// Folders first, A→Z (`sort`), with file-type icons, Git status and type-to-search. Right-click a row for its menu;
// Rename edits the row in place.
export default function FileTree() {
  const [nodes, setNodes] = useState(PROJECT)
  const [selected, setSelected] = useState<string[]>(['packages/ui/src/components/tree.tsx'])
  const [renaming, setRenaming] = useState<string | null>(null)

  return (
    // The ThemeScope is only here so the portalled menu wears this demo's light / dark appearance.
    <ThemeScope>
      <div className="mx-auto flex h-[420px] w-full max-w-sm flex-col overflow-hidden rounded-panel border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
          <Icon name="folder" size={15} /> ui
        </div>
        <Tree aria-label="Project files" items={nodes} sort search gitStatus={GIT}
          defaultExpanded={['packages', 'packages/ui', 'packages/ui/src', 'packages/ui/src/components']}
          selectedIds={selected} onSelectionChange={setSelected}
          renamingId={renaming} onRenameEnd={() => setRenaming(null)}
          onRename={(node, name) => setNodes((list) => renamed(list, node.id, name))}
          contextMenu={(node) => (
            <ContextMenuContent aria-label={`${node.name} actions`} onAction={(key) => {
              if (key === 'delete') setNodes((list) => prune(list, node.id))
              if (key === 'rename') setRenaming(node.id)
            }}>
              {node.children ? <ContextMenuItem id="new" icon={<Icon name="doc" size={20} />}>New File…</ContextMenuItem> : null}
              <ContextMenuItem id="rename" icon={<Icon name="pencil" size={20} />}>Rename</ContextMenuItem>
              <ContextMenuItem id="copy" icon={<Icon name="link" size={20} />}>Copy Path</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem id="delete" variant="destructive" icon={<Icon name="trash" size={20} />}>Delete</ContextMenuItem>
            </ContextMenuContent>
          )}
          className="min-h-0 flex-1 p-1.5" />
        <div className="truncate border-t border-border bg-muted/50 px-3 py-1.5 font-mono text-caption text-muted-foreground">{selected[0] || 'Nothing selected'}</div>
      </div>
    </ThemeScope>
  )
}

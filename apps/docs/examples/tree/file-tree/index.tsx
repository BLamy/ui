import { useState } from 'react'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tree, type TreeNode } from '@/components/ui/tree'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

const dir = (path: string, children: TreeNode[]): TreeNode => ({ value: path, label: path.split('/').pop()!, children })
const file = (path: string): TreeNode => ({ value: path, label: path.split('/').pop()! })

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

const prune = (list: TreeNode[], value: string): TreeNode[] =>
  list.filter((n) => n.value !== value).map((n) => (n.children ? { ...n, children: prune([...n.children], value) } : n))
const renamed = (list: TreeNode[], value: string, label: string): TreeNode[] =>
  list.map((n) => (n.value === value ? { ...n, label } : n.children ? { ...n, children: renamed([...n.children], value, label) } : n))

// Folders first, A→Z (`sort`), with file-type icons, Git status and a search field. Right-click a row for its menu;
// Rename (or F2) edits the row in place.
export default function FileTree() {
  const [nodes, setNodes] = useState(PROJECT)
  const [selected, setSelected] = useState<string | null>('packages/ui/src/components/tree.tsx')
  const [editing, setEditing] = useState<string | null>(null)

  return (
    // The ThemeScope is only here so the portalled menu wears this demo's light / dark appearance.
    <ThemeScope>
      <div className="mx-auto flex h-[420px] w-full max-w-sm flex-col overflow-hidden rounded-panel border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
          <Icon name="folder" size={15} /> ui
        </div>
        <Tree aria-label="Project files" items={nodes} sort search gitStatus={GIT}
          defaultExpanded={['packages', 'packages/ui', 'packages/ui/src', 'packages/ui/src/components']}
          value={selected} onValueChange={setSelected}
          editing={editing} onEditingChange={setEditing}
          onRename={(node, label) => setNodes((list) => renamed(list, node.value, label))}
          contextMenu={(node) => (
            <DropdownMenuContent aria-label={`${node.label} actions`}>
              {node.children ? <DropdownMenuItem value="new" icon={<Icon name="doc" size={20} />}>New File…</DropdownMenuItem> : null}
              <DropdownMenuItem value="rename" icon={<Icon name="pencil" size={20} />} onSelect={() => setEditing(node.value)}>Rename</DropdownMenuItem>
              <DropdownMenuItem value="copy" icon={<Icon name="link" size={20} />}>Copy Path</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />} onSelect={() => setNodes((list) => prune(list, node.value))}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          )}
          className="min-h-0 flex-1 p-1.5" />
        <div className="truncate border-t border-border bg-muted/50 px-3 py-1.5 font-mono text-caption text-muted-foreground">{selected ?? 'Nothing selected'}</div>
      </div>
    </ThemeScope>
  )
}

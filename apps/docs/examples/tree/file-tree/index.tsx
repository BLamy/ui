import { useMemo, useState } from 'react'
import { Collection, type Key, type Selection } from 'react-aria-components'
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { Tree, TreeFileIcon, TreeFolderIcon, TreeItem } from '@/components/ui/tree'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

interface Node { id: string; name: string; status?: 'M' | 'A'; children?: Node[] }

const dir = (path: string, children: Node[]): Node => ({ id: path, name: path.split('/').pop()!, children })
const file = (path: string, status?: Node['status']): Node => ({ id: path, name: path.split('/').pop()!, status })

const PROJECT: Node[] = [
  dir('apps', [
    dir('apps/docs', [
      dir('apps/docs/pages', [file('apps/docs/pages/introduction.md'), file('apps/docs/pages/tree.mdx', 'A')]),
      file('apps/docs/vite.config.mts'),
    ]),
  ]),
  dir('packages', [
    dir('packages/ui', [
      dir('packages/ui/src', [
        dir('packages/ui/src/components', [
          file('packages/ui/src/components/button.tsx'),
          file('packages/ui/src/components/tree.tsx', 'A'),
          file('packages/ui/src/components/list-box.tsx', 'M'),
        ]),
        file('packages/ui/src/index.ts', 'M'),
        file('packages/ui/src/styles.css'),
      ]),
      file('packages/ui/package.json'),
    ]),
  ]),
  file('README.md'),
  file('logo.svg'),
  file('nx.json'),
]

/** Folders first, then files, each alphabetical — as in Finder and VS Code. */
const sorted = (nodes: Node[]): Node[] => [...nodes]
  .sort((a, b) => Number(!a.children) - Number(!b.children) || a.name.localeCompare(b.name))
  .map((n) => n.children ? { ...n, children: sorted(n.children) } : n)

const STATUS = { M: 'text-[#C08A00] dark:text-[#E2B33C]', A: 'text-[#1F9D55] dark:text-[#3FC47A]' }

// A dynamic tree: the data is a nested array, rendered by a function and a nested <Collection>. Folders open with
// the chevron, ArrowRight / ArrowLeft or a double-click; right-click any row for its menu.
export default function FileTree() {
  const [nodes, setNodes] = useState(() => sorted(PROJECT))
  const [selected, setSelected] = useState<Selection>(new Set(['packages/ui/src/components/tree.tsx']))
  const [expanded, setExpanded] = useState<Set<Key>>(new Set(['packages', 'packages/ui', 'packages/ui/src', 'packages/ui/src/components']))
  const path = useMemo(() => selected === 'all' ? '' : String([...selected][0] ?? ''), [selected])

  const remove = (id: string) => {
    const prune = (list: Node[]): Node[] => list.filter((n) => n.id !== id).map((n) => n.children ? { ...n, children: prune(n.children) } : n)
    setNodes(prune)
  }
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next
  })

  function render(node: Node) {
    return (
      <TreeItem
        id={node.id}
        title={node.name}
        icon={({ isExpanded }) => node.children ? <TreeFolderIcon open={isExpanded} /> : <TreeFileIcon name={node.name} />}
        trailing={node.status ? <span className={`font-semibold ${STATUS[node.status]} group-data-selected/tree-item:text-inherit`}>{node.status}</span> : null}
        onAction={node.children ? () => toggle(node.id) : undefined}
        contextMenu={
          <ContextMenuContent aria-label={`${node.name} actions`} onAction={(key) => { if (key === 'delete') remove(node.id) }}>
            {node.children ? <ContextMenuItem id="new" icon={<Icon name="doc" size={20} />}>New File…</ContextMenuItem> : null}
            <ContextMenuItem id="rename" icon={<Icon name="pencil" size={20} />}>Rename…</ContextMenuItem>
            <ContextMenuItem id="copy" icon={<Icon name="link" size={20} />}>Copy Path</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem id="delete" variant="destructive" icon={<Icon name="trash" size={20} />}>Delete</ContextMenuItem>
          </ContextMenuContent>
        }
      >
        {node.children ? <Collection items={node.children}>{render}</Collection> : null}
      </TreeItem>
    )
  }

  // The ThemeScope is only here so the portalled menu wears this demo's light / dark appearance.
  return (
    <ThemeScope>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-panel border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
          <Icon name="folder" size={15} /> ui
        </div>
        <Tree aria-label="Project files" items={nodes} selectionMode="single" selectionBehavior="replace"
          selectedKeys={selected} onSelectionChange={setSelected}
          expandedKeys={expanded} onExpandedChange={setExpanded}
          className="max-h-[360px] overflow-y-auto p-1.5">
          {render}
        </Tree>
        <div className="truncate border-t border-border bg-muted/50 px-3 py-1.5 font-mono text-caption text-muted-foreground">{path || 'Nothing selected'}</div>
      </div>
    </ThemeScope>
  )
}

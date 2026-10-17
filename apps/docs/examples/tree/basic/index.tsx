import { useState } from 'react'
import { Tree, type TreeNode } from '@/components/ui/tree'

const MAILBOXES: TreeNode[] = [
  {
    id: 'icloud', name: 'iCloud', children: [
      { id: 'inbox', name: 'Inbox', icon: 'tray', detail: '12' },
      { id: 'drafts', name: 'Drafts', icon: 'doc', detail: '3' },
      {
        id: 'projects', name: 'Projects', children: [
          { id: 'launch', name: 'Launch', icon: 'folder', detail: '4' },
          { id: 'archive', name: 'Archive', icon: 'folder', dimmed: true },
        ],
      },
    ],
  },
  { id: 'trash', name: 'Trash', icon: 'trash' },
]

// Any hierarchy, not only files: rows keep the order of `items`, leaves take an icon from the set, and `detail`
// sits after the label. ⌘-click or ⇧-click selects more than one.
export default function Basic() {
  const [selected, setSelected] = useState<string[]>(['inbox'])
  return (
    <div className="mx-auto flex h-64 w-full max-w-xs flex-col">
      <Tree aria-label="Mailboxes" items={MAILBOXES} icons="none" defaultExpanded="all"
        selectedIds={selected} onSelectionChange={setSelected} className="min-h-0 flex-1" />
      <p className="mt-2 text-footnote text-muted-foreground">Selected: {selected.join(', ') || 'none'}</p>
    </div>
  )
}

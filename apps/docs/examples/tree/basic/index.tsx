import { useState } from 'react'
import { Tree, type TreeNode } from '@/components/ui/tree'

const MAILBOXES: TreeNode[] = [
  {
    value: 'icloud', label: 'iCloud', children: [
      { value: 'inbox', label: 'Inbox', icon: 'tray', trailing: '12' },
      { value: 'drafts', label: 'Drafts', icon: 'doc', trailing: '3' },
      {
        value: 'projects', label: 'Projects', children: [
          { value: 'launch', label: 'Launch', icon: 'folder', trailing: '4' },
          { value: 'archive', label: 'Archive', icon: 'folder', dimmed: true },
        ],
      },
    ],
  },
  { value: 'trash', label: 'Trash', icon: 'trash' },
]

// Any hierarchy, not only files: rows keep the order of `items`, leaves take an icon from the set, and `detail`
// sits after the label. With `mode="multiple"`, ⌘-click or ⇧-click selects more than one.
export default function Basic() {
  const [selected, setSelected] = useState<string[]>(['inbox'])
  return (
    <div className="mx-auto flex h-64 w-full max-w-xs flex-col">
      <Tree aria-label="Mailboxes" items={MAILBOXES} icons={false} defaultExpanded="all" expandOnPress={false}
        mode="multiple" value={selected} onValueChange={setSelected} className="min-h-0 flex-1" />
      <p className="mt-2 text-footnote text-muted-foreground">Selected: {selected.join(', ') || 'none'}</p>
    </div>
  )
}

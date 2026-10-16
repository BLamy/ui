import { useState } from 'react'
import type { Selection } from 'react-aria-components'
import { Tree, TreeItem } from '@/components/ui/tree'
import { Icon } from '@/lib/icon'

// A static tree: nest TreeItems directly. `selectionMode="multiple"` with the default `toggle` behavior lets each
// press add or remove a row; `trailing` takes counts and badges.
export default function Basic() {
  const [selected, setSelected] = useState<Selection>(new Set(['inbox']))
  const count = selected === 'all' ? 'All' : selected.size
  return (
    <div className="mx-auto grid w-full max-w-xs gap-3">
      <Tree aria-label="Mailboxes" selectionMode="multiple" selectedKeys={selected} onSelectionChange={setSelected}
        defaultExpandedKeys={['icloud', 'projects']}>
        <TreeItem id="icloud" title="iCloud" icon={<Icon name="cloud" size={18} className="text-primary" />}>
          <TreeItem id="inbox" title="Inbox" icon={<Icon name="tray" size={18} />} trailing="12" />
          <TreeItem id="drafts" title="Drafts" icon={<Icon name="doc" size={18} />} trailing="3" />
          <TreeItem id="projects" title="Projects" icon={<Icon name="folder" size={18} />}>
            <TreeItem id="launch" title="Launch" icon={<Icon name="folder" size={18} />} trailing="4" />
            <TreeItem id="archive" title="Archive" icon={<Icon name="folder" size={18} />} isDisabled />
          </TreeItem>
        </TreeItem>
        <TreeItem id="trash" title="Trash" icon={<Icon name="trash" size={18} />} />
      </Tree>
      <p className="m-0 px-1 text-footnote text-muted-foreground">{count} selected</p>
    </div>
  )
}

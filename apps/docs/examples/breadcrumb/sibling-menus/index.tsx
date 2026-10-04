import { useState } from 'react'
import { Breadcrumb, type BreadcrumbEntry, type BreadcrumbItemData } from '@/components/ui/breadcrumb'

// Like VS Code's: an item with `items` opens the other entries of its parent
// when pressed, and `selectedId` marks the current one.
const FOLDERS = ['ui', 'docs', 'catalog', 'registry']
const FILES = ['avatar.tsx', 'badge.tsx', 'breadcrumb.tsx', 'button.tsx', 'card.tsx']

export default function SiblingMenus() {
  const [folder, setFolder] = useState('ui')
  const [file, setFile] = useState('breadcrumb.tsx')

  const entries = (names: string[], icon: string, pick: (name: string) => void): BreadcrumbEntry[] =>
    names.map((name) => ({ id: name, label: name, icon, onPress: () => pick(name) }))

  const path: BreadcrumbItemData[] = [
    { id: 'home', label: 'Home', icon: 'house', href: '#home' },
    { id: 'folder', label: folder, icon: 'folder', items: entries(FOLDERS, 'folder', setFolder), selectedId: folder },
    { id: 'file', label: file, icon: 'doc', items: entries(FILES, 'doc', setFile), selectedId: file },
  ]

  return (
    <div className="mx-auto grid max-w-md gap-3 p-2">
      <Breadcrumb items={path} />
      <p className="text-footnote text-foreground/70">
        Open <b className="font-medium text-foreground">{folder}/{file}</b>. Press a segment to pick another.
      </p>
    </div>
  )
}

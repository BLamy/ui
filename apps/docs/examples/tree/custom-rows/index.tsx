import { Badge } from '@/components/ui/badge'
import { Tree, TreeItemIndicator, TreeItemLabel, type TreeNode } from '@/components/ui/tree'

const TEAMS: TreeNode[] = [
  { value: 'design', label: 'Design', children: [
    { value: 'ada', label: 'Ada Lovelace', detail: 'Lead' },
    { value: 'grace', label: 'Grace Hopper', detail: 'Away' },
  ] },
  { value: 'platform', label: 'Platform', children: [
    { value: 'alan', label: 'Alan Turing', detail: 'On call' },
  ] },
]

// renderRow draws a row of your own on the same virtual tree: return a TreeItemLabel (it carries the row's look,
// selection and the name typing finds), with a TreeItemIndicator in a branch. Keyboard, focus and scrolling stay the tree's.
export default function CustomRows() {
  return (
    <div className="mx-auto flex h-56 w-full max-w-xs flex-col">
      <Tree aria-label="Teams" items={TEAMS} defaultExpanded="all" defaultValue="ada" className="min-h-0 flex-1"
        renderRow={(node, { branch }) => (
          <TreeItemLabel>
            {branch ? <TreeItemIndicator /> : <span className="size-4 shrink-0" />}
            <span className={branch ? 'min-w-0 flex-1 truncate font-semibold' : 'min-w-0 flex-1 truncate'}>{node.label}</span>
            {node.detail ? <Badge variant="secondary">{node.detail}</Badge> : null}
          </TreeItemLabel>
        )} />
    </div>
  )
}

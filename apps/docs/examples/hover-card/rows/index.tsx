import { Avatar } from '@/components/ui/avatar'
import { HoverCardHeader } from '@/components/ui/hover-card'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { Tree, type TreeNode } from '@/components/ui/tree'
import { ThemeScope } from '@/lib/theme'

const people = [
  { f: 'Maya', l: 'Lindqvist', role: 'Industrial design', where: 'Stockholm · 9:41 AM', projects: 4 },
  { f: 'Jonas', l: 'Ito', role: 'Motion engineering', where: 'Osaka · 4:41 PM', projects: 7 },
  { f: 'Priya', l: 'Raman', role: 'Accessibility', where: 'Toronto · 3:41 AM', projects: 2 },
]

const FILES: TreeNode[] = [
  {
    value: 'src', label: 'src', children: [
      { value: 'src/app.tsx', label: 'app.tsx' },
      { value: 'src/theme.css', label: 'theme.css' },
    ],
  },
  { value: 'README.md', label: 'README.md' },
]
const INFO: Record<string, { size: string; changed: string; by: string }> = {
  'src/app.tsx': { size: '4.2 KB', changed: '2 hours ago', by: 'Jonas Ito' },
  'src/theme.css': { size: '1.1 KB', changed: 'yesterday', by: 'Maya Lindqvist' },
  'README.md': { size: '2.8 KB', changed: 'last week', by: 'Priya Raman' },
}

// A ListRow's `preview` and a Tree's `preview(node)` open a hover card beside
// the row. The tree shares one card between its rows, so sweeping down it
// moves the card from row to row at once.
export default function Rows() {
  return (
    <ThemeScope className="mx-auto grid max-w-2xl gap-6 py-4 sm:grid-cols-[1fr_220px]">
      <List variant="inset">
        <ListSection title="Team">
          {people.map((p) => (
            <ListRow
              key={p.l}
              icon={<Avatar name={`${p.f} ${p.l}`} size={36} />}
              title={`${p.f} ${p.l}`}
              description={p.role}
              accessory="chevron"
              onClick={() => {}}
              preview={
                <>
                  <HoverCardHeader icon={<Avatar name={`${p.f} ${p.l}`} size={44} />} title={`${p.f} ${p.l}`} description={p.role} />
                  <p className="mt-3 mb-0 text-footnote text-muted-foreground">{p.where} · {p.projects} projects</p>
                </>
              }
            />
          ))}
        </ListSection>
      </List>
      <div className="flex h-48 flex-col">
        <Tree aria-label="Files" items={FILES} defaultExpanded="all" className="min-h-0 flex-1"
          preview={(node) => {
            const info = INFO[node.value]
            return info ? (
              <>
                <HoverCardHeader title={node.label} description={node.value} />
                <p className="mt-2 mb-0 text-footnote text-muted-foreground">{info.size} · changed {info.changed} by {info.by}</p>
              </>
            ) : null
          }} />
      </div>
    </ThemeScope>
  )
}

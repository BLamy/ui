import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { Toolbar, ToolbarButton, ToolbarText } from '@/components/ui/toolbar'

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', role: 'Analyst' },
  { id: 'grace', name: 'Grace Hopper', role: 'Admiral' },
  { id: 'alan', name: 'Alan Turing', role: 'Mathematician' },
  { id: 'katherine', name: 'Katherine Johnson', role: 'Navigator' },
  { id: 'margaret', name: 'Margaret Hamilton', role: 'Flight software' },
]

export default function ToolbarEditMode() {
  const [editing, setEditing] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(['grace']))
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set())
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const rows = PEOPLE.filter((p) => !gone.has(p.id))
  const allFavorite = picked.size > 0 && [...picked].every((id) => favorites.has(id))
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="relative mx-auto h-[420px] w-full max-w-sm overflow-hidden rounded-card bg-background shadow-hairline">
      <div className="absolute inset-0 overflow-y-auto pt-2 pb-20">
        <div className="flex justify-end px-4">
          <Button variant="link" onClick={() => { setEditing((e) => !e); setPicked(new Set()) }}>
            {editing ? 'Done' : 'Select'}
          </Button>
        </div>
        <List variant="inset">
          <ListSection title="Contacts">
            {rows.map((p) => (
              <ListRow key={p.id} title={p.name} description={p.role} icon={<Avatar name={p.name} />}
                editing={editing} checked={picked.has(p.id)} onClick={editing ? () => toggle(p.id) : undefined} />
            ))}
          </ListSection>
        </List>
        {!rows.length && (
          <Button variant="link" className="mx-auto mt-4 flex" onClick={() => setGone(new Set())}>Restore contacts</Button>
        )}
      </div>
      {editing && (
        <Toolbar variant="bar" aria-label="Edit" className="absolute inset-x-0 bottom-0 z-10">
          <ToolbarButton
            disabled={!picked.size}
            onClick={() =>
              setFavorites((s) => {
                const n = new Set(s)
                picked.forEach((id) => (allFavorite ? n.delete(id) : n.add(id)))
                return n
              })
            }
          >
            {allFavorite ? 'Unfavorite' : 'Favorite'}
          </ToolbarButton>
          <ToolbarText aria-live="polite">{picked.size ? `${picked.size} selected` : 'Select items'}</ToolbarText>
          <ToolbarButton
            tone="destructive"
            disabled={!picked.size}
            onClick={() => {
              setGone((g) => new Set([...g, ...picked]))
              setPicked(new Set())
            }}
          >
            Delete
          </ToolbarButton>
        </Toolbar>
      )}
    </div>
  )
}

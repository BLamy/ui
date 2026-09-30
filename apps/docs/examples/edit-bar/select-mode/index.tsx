import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { EditBar } from '@/components/ui/edit-bar'
import { Button } from '@/components/ui/button'

type Photo = { id: number; name: string; fav: boolean }

const initial: Photo[] = [
  { id: 1, name: 'Harbor at dusk', fav: false },
  { id: 2, name: 'Market stalls', fav: true },
  { id: 3, name: 'Night train', fav: false },
  { id: 4, name: 'Rooftop garden', fav: true },
  { id: 5, name: 'Ferry crossing', fav: false },
]

// EditBar is absolutely positioned at the bottom of the nearest positioned
// ancestor. It is stateless: you pass the `count` of selected items (0 disables
// both actions), `allFav` to flip Favorite into Unfavorite, and act in
// `onFav` / `onDelete`.
export default function SelectMode() {
  const [photos, setPhotos] = useState(initial)
  const [selected, setSelected] = useState<Set<number>>(new Set([2, 4]))
  const chosen = photos.filter((p) => selected.has(p.id))
  const allFav = chosen.length > 0 && chosen.every((p) => p.fav)
  return (
    <div className="relative mx-auto h-[400px] max-w-sm overflow-hidden rounded-card bg-background shadow-hairline">
      <div className="absolute inset-0 overflow-y-auto pb-20">
        <ul className="m-0 list-none p-0">
          {photos.map((p) => (
            <li key={p.id} className="px-5 shadow-hairline-b">
              <Checkbox
                shape="circle"
                className="w-full py-3"
                isSelected={selected.has(p.id)}
                onChange={(on) =>
                  setSelected((s) => {
                    const n = new Set(s)
                    if (on) n.add(p.id)
                    else n.delete(p.id)
                    return n
                  })
                }
              >
                <span className="flex-1 text-body">{p.name}</span>
                {p.fav && <span className="text-footnote text-warning">Favorite</span>}
              </Checkbox>
            </li>
          ))}
        </ul>
        {photos.length === 0 && (
          <div className="grid justify-items-center gap-3 p-10 text-muted-foreground">
            No photos left
            <Button size="sm" variant="secondary" onPress={() => setPhotos(initial)}>
              Restore
            </Button>
          </div>
        )}
      </div>
      <EditBar
        count={chosen.length}
        allFav={allFav}
        onFav={() =>
          setPhotos((ps) =>
            ps.map((p) => (selected.has(p.id) ? { ...p, fav: !allFav } : p)),
          )
        }
        onDelete={() => {
          setPhotos((ps) => ps.filter((p) => !selected.has(p.id)))
          setSelected(new Set())
        }}
      />
    </div>
  )
}

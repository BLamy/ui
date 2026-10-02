import { useDragAndDrop, useListData } from 'react-aria-components'
import { ListBox, ListBoxItem } from '@/components/ui/list-box'
import { Icon } from '@/lib/icon'

interface Track {
  id: string
  name: string
}

const TRACKS: Track[] = ['Golden Hour', 'Nightcall', 'Midnight City', 'Heat Waves', 'Dreams'].map((name) => ({ id: name, name }))

// useDragAndDrop returns the hooks a RAC collection needs; ListBox, GridList,
// Table and Tree all take them as `dragAndDropHooks`. `onReorder`
// fires for drops between items of the same list, by mouse or keyboard. The
// grip is only decoration: the whole row is the drag handle.
export default function Reorder() {
  const list = useListData({ initialItems: TRACKS })
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ 'text/plain': list.getItem(key)?.name ?? '' })),
    onReorder(e) {
      if (e.target.dropPosition === 'before') list.moveBefore(e.target.key, e.keys)
      else if (e.target.dropPosition === 'after') list.moveAfter(e.target.key, e.keys)
    },
  })

  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <ListBox
        aria-label="Up next"
        items={list.items}
        selectionMode="multiple"
        dragAndDropHooks={dragAndDropHooks}
        className="data-drop-target:ring-2 data-drop-target:ring-primary"
      >
        {(track) => (
          <ListBoxItem id={track.id} textValue={track.name}>
            <span className="flex items-center gap-3">
              <Icon name="menu" size={18} className="text-foreground" />
              {track.name}
            </span>
          </ListBoxItem>
        )}
      </ListBox>
      <p className="m-0 text-footnote text-foreground" aria-live="polite">
        Order: {list.items.map((t) => t.name).join(' › ')}
      </p>
    </div>
  )
}

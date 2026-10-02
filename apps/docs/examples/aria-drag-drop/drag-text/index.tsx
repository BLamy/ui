import { useRef, useState } from 'react'
import { isTextDropItem, mergeProps, useDrag, useDrop, useFocusRing } from 'react-aria'

const FRUIT = ['Apple', 'Pear', 'Plum']

// A draggable carries one item with as many formats as you like. Here every
// chip offers its name as text/plain (so it can also be dropped into any text
// field or another app) plus a custom type only our own target looks for.
function Chip({ label }: { label: string }) {
  const { dragProps, isDragging } = useDrag({
    getItems: () => [{ 'text/plain': label, 'application/x-bl-fruit': label }],
    getAllowedDropOperations: () => ['copy'],
  })
  const { focusProps, isFocusVisible } = useFocusRing()
  return (
    <div
      {...mergeProps(dragProps, focusProps)}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-dragging={isDragging || undefined}
      data-focus-visible={isFocusVisible || undefined}
      className="cursor-grab rounded-full bg-secondary px-4 py-2 text-body text-secondary-foreground outline-none select-none data-dragging:opacity-40 data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
    >
      {label}
    </div>
  )
}

function Basket({ items, onAdd }: { items: string[]; onAdd: (label: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { dropProps, isDropTarget } = useDrop({
    ref,
    // Only offer to drop what we understand; anything else shows the "no drop" cursor.
    getDropOperation: (types) => (types.has('application/x-bl-fruit') ? 'copy' : 'cancel'),
    onDrop: async (e) => {
      for (const item of e.items) {
        if (isTextDropItem(item) && item.types.has('application/x-bl-fruit')) onAdd(await item.getText('application/x-bl-fruit'))
      }
    },
  })
  const { focusProps, isFocusVisible } = useFocusRing()
  return (
    <div
      {...mergeProps(dropProps, focusProps)}
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label="Basket"
      data-drop-target={isDropTarget || undefined}
      data-focus-visible={isFocusVisible || undefined}
      className="grid min-h-24 content-center justify-items-center gap-1 rounded-panel border border-dashed border-border bg-card p-4 text-center text-footnote text-foreground outline-none data-drop-target:border-primary data-drop-target:bg-accent data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
    >
      <span>Basket</span>
      <span className="text-body text-foreground">{items.length ? items.join(', ') : 'Drop fruit here'}</span>
    </div>
  )
}

export default function DragText() {
  const [basket, setBasket] = useState<string[]>([])
  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <div className="flex flex-wrap gap-2">
        {FRUIT.map((f) => (
          <Chip key={f} label={f} />
        ))}
      </div>
      <Basket items={basket} onAdd={(l) => setBasket((b) => [...b, l])} />
      <p className="m-0 text-footnote text-foreground">
        Drag a chip into the basket. With the keyboard: focus a chip and press Enter (focus jumps to the basket), then Enter again to drop; Escape cancels.
      </p>
    </div>
  )
}

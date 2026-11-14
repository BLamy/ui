/* A masonry grid of modules you can rearrange and resize. Columns follow the container's width; every module spans
   some of them and as many 8px rows as its content (or the height you dragged it to) needs, and `dense` flow packs
   the gaps. Drag a module's grip to move it (the others make room); drag its corner to resize. Both handles work
   from the keyboard: the grip picks its module up with Space or Enter, the arrows move it and Space drops it; the
   corner's arrows resize. The interaction is the `rack-grid` primitive (rack-grid.ts); this file is the layout. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { RackGridCorner, RackGridGrip, RackGridItem, RackGridRoot } from "./rack-grid-parts"

export interface GridItem {
  key: string
  label: string
  node: ReactNode
  /** Default width in twelfths of the grid (12 = full width). */
  span?: number
}

export interface GridLayout {
  order: string[]
  /** Width in twelfths, and an optional minimum height in px, per item key. */
  sizes: Record<string, { w: number; h?: number }>
}

export interface RackGridProps {
  items: GridItem[]
  layout: GridLayout
  onLayoutChange: (layout: GridLayout) => void
}

const ROW = 8
const GAP = 10

/** Items in layout order: known keys first, new ones appended. */
function ordered(items: GridItem[], order: string[]): GridItem[] {
  const byKey = new Map(items.map((i) => [i.key, i]))
  const out = order.map((k) => byKey.get(k)).filter((i): i is GridItem => !!i)
  for (const i of items) if (!order.includes(i.key)) out.push(i)
  return out
}

export function RackGrid({ items, layout, onLayoutChange }: RackGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(12)
  const [heights, setHeights] = useState<Record<string, number>>({})
  const contents = useRef(new Map<string, HTMLDivElement>())
  const byKey = new Map(items.map((i) => [i.key, i]))
  const joined = ordered(items, layout.order).map((i) => i.key).join("\u001f")
  const keys = useMemo(() => (joined ? joined.split("\u001f") : []), [joined])
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // Columns: one per ~84px of width, at most 12 — spans are stored in twelfths and scaled.
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const measure = () => setCols(Math.max(2, Math.min(12, Math.floor((grid.clientWidth + GAP) / 84))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(grid)
    return () => ro.disconnect()
  }, [])

  // Masonry: each module spans as many rows as its content is tall.
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let next = prev
        for (const e of entries) {
          const key = (e.target as HTMLElement).dataset.content!
          const h = Math.ceil((e.target as HTMLElement).offsetHeight)
          if (prev[key] !== h) next = { ...next, [key]: h }
        }
        return next
      })
    })
    contents.current.forEach((el) => ro.observe(el))
    return () => ro.disconnect()
  }, [joined])

  const span = (item: GridItem) => {
    const w = layout.sizes[item.key]?.w ?? item.span ?? 6
    return Math.max(1, Math.min(cols, Math.round((w / 12) * cols)))
  }
  const rows = (item: GridItem) => {
    const h = Math.max(heights[item.key] ?? 120, layout.sizes[item.key]?.h ?? 0)
    return Math.ceil((h + GAP) / (ROW + GAP))
  }

  return (
    <RackGridRoot
      ref={gridRef}
      className="strudel-grid"
      aria-label="Modules"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: ROW, rowGap: GAP, columnGap: GAP }}
      order={keys}
      onOrderChange={(order) => onLayoutChange({ ...layoutRef.current, order })}
      sizes={layout.sizes}
      onSizesChange={(sizes) => onLayoutChange({ order: keys, sizes })}
      columns={cols}
      gap={GAP}
      label={(key) => byKey.get(key)?.label}
    >
      {({ order }) =>
        order.map((key) => {
          const item = byKey.get(key)
          if (!item) return null
          const h = layout.sizes[key]?.h
          return (
            <RackGridItem
              key={key}
              value={key}
              span={item.span}
              className="strudel-grid__item"
              data-grid-key={key}
              style={{ gridColumn: `span ${span(item)}`, gridRow: `span ${rows(item)}` }}
            >
              <div
                ref={(el) => {
                  if (el) contents.current.set(key, el)
                  else contents.current.delete(key)
                }}
                data-content={key}
                className="strudel-grid__content"
                style={h ? { minHeight: h } : undefined}
              >
                {item.node}
              </div>
              <RackGridGrip
                className="strudel-grid__grip"
                aria-label={`Move ${item.label}`}
                title="Drag to move, or press Space, move with the arrow keys, and press Space to drop"
              />
              <RackGridCorner className="strudel-grid__corner" aria-label={`Resize ${item.label}`} title="Drag to resize, or use the arrow keys" />
            </RackGridItem>
          )
        })
      }
    </RackGridRoot>
  )
}

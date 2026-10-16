/* A masonry grid of modules you can rearrange and resize. Columns follow the container's width; every module spans
   some of them and as many 8px rows as its content (or the height you dragged it to) needs, and `dense` flow packs
   the gaps. Drag a module's grip to move it (others reflow under the pointer); drag its corner to resize. Both
   handles are keyboard-operable: arrows move or resize, Home/End move to the ends. */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"

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
  const [dragging, setDragging] = useState<string | null>(null)
  const drag = useRef<{ key: string; dx: number; dy: number; x: number; y: number } | null>(null)
  const elements = useRef(new Map<string, HTMLDivElement>())
  const list = ordered(items, layout.order)
  const keys = list.map((i) => i.key)
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
    elements.current.forEach((el) => {
      const content = el.querySelector<HTMLElement>("[data-content]")
      if (content) ro.observe(content)
    })
    return () => ro.disconnect()
  }, [keys.join("|")])

  const span = (item: GridItem) => {
    const w = layout.sizes[item.key]?.w ?? item.span ?? 6
    return Math.max(1, Math.min(cols, Math.round((w / 12) * cols)))
  }
  const rows = (item: GridItem) => {
    const h = Math.max(heights[item.key] ?? 120, layout.sizes[item.key]?.h ?? 0)
    return Math.ceil((h + GAP) / (ROW + GAP))
  }
  const setSize = (key: string, size: { w?: number; h?: number }) => {
    const cur = layoutRef.current
    onLayoutChange({ order: keys, sizes: { ...cur.sizes, [key]: { ...cur.sizes[key], w: cur.sizes[key]?.w ?? 6, ...size } } })
  }
  const move = (key: string, to: number) => {
    const from = keys.indexOf(key)
    const next = keys.filter((k) => k !== key)
    next.splice(Math.max(0, Math.min(next.length, to)), 0, key)
    if (from !== next.indexOf(key)) onLayoutChange({ ...layoutRef.current, order: next })
  }

  // Moving: the module follows the pointer; hovering another module takes its place.
  const place = (key: string, x: number, y: number) => {
    const el = elements.current.get(key)
    const grid = gridRef.current
    const d = drag.current
    if (!el || !grid || !d) return
    const box = grid.getBoundingClientRect()
    el.style.transform = `translate(${x - d.dx - box.left - el.offsetLeft}px, ${y - d.dy - box.top - el.offsetTop}px)`
  }
  const onGripDown = (key: string) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    const el = elements.current.get(key)!
    const r = el.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { key, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY }
    setDragging(key)
  }
  const onGripMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    d.x = e.clientX
    d.y = e.clientY
    place(d.key, e.clientX, e.clientY)
    const dragged = elements.current.get(d.key)!
    dragged.style.pointerEvents = "none"
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-grid-key]")
    dragged.style.pointerEvents = ""
    const target = under?.dataset.gridKey
    if (target && target !== d.key) move(d.key, keys.indexOf(target))
  }
  const onGripUp = () => {
    const d = drag.current
    if (!d) return
    const el = elements.current.get(d.key)
    if (el) el.style.transform = ""
    drag.current = null
    setDragging(null)
  }
  // After a reorder the module's slot moved: keep it under the pointer.
  useLayoutEffect(() => {
    const d = drag.current
    if (d) place(d.key, d.x, d.y)
  })

  const onGripKey = (key: string) => (e: KeyboardEvent<HTMLElement>) => {
    const i = keys.indexOf(key)
    const to = { ArrowLeft: i - 1, ArrowUp: i - 1, ArrowRight: i + 1, ArrowDown: i + 1, Home: 0, End: keys.length - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    move(key, to)
  }

  // Resizing: the corner sets the width in columns and a minimum height.
  const resize = useRef<{ key: string; left: number; top: number } | null>(null)
  const onCornerDown = (key: string) => (e: PointerEvent<HTMLElement>) => {
    const r = elements.current.get(key)!.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    resize.current = { key, left: r.left, top: r.top }
  }
  const onCornerMove = (e: PointerEvent<HTMLElement>) => {
    const r = resize.current
    const grid = gridRef.current
    if (!r || !grid) return
    const colWidth = (grid.clientWidth - GAP * (cols - 1)) / cols
    const c = Math.max(1, Math.min(cols, Math.round((e.clientX - r.left + GAP) / (colWidth + GAP))))
    setSize(r.key, { w: Math.round((c / cols) * 12 * 100) / 100, h: Math.max(60, Math.round(e.clientY - r.top)) })
  }
  const onCornerUp = () => {
    resize.current = null
  }
  const onCornerKey = (item: GridItem) => (e: KeyboardEvent<HTMLElement>) => {
    const w = layout.sizes[item.key]?.w ?? item.span ?? 6
    const h = layout.sizes[item.key]?.h ?? heights[item.key] ?? 120
    const step = 12 / cols
    const next = {
      ArrowRight: { w: Math.min(12, w + step) },
      ArrowLeft: { w: Math.max(step, w - step) },
      ArrowDown: { h: h + 24 },
      ArrowUp: { h: Math.max(0, h - 24) },
    }[e.key]
    if (!next) return
    e.preventDefault()
    setSize(item.key, next)
  }

  return (
    <div ref={gridRef} className="strudel-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: ROW, rowGap: GAP, columnGap: GAP }}>
      {list.map((item) => {
        const h = layout.sizes[item.key]?.h
        return (
          <div
            key={item.key}
            ref={(el) => {
              if (el) elements.current.set(item.key, el)
              else elements.current.delete(item.key)
            }}
            className="strudel-grid__item"
            data-grid-key={item.key}
            data-dragging={dragging === item.key || undefined}
            style={{ gridColumn: `span ${span(item)}`, gridRow: `span ${rows(item)}` }}
          >
            <div data-content={item.key} className="strudel-grid__content" style={h ? { minHeight: h } : undefined}>
              {item.node}
            </div>
            <button
              type="button"
              className="strudel-grid__grip"
              aria-label={`Move ${item.label}`}
              title="Drag to move (arrow keys too)"
              onPointerDown={onGripDown(item.key)}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
              onPointerCancel={onGripUp}
              onKeyDown={onGripKey(item.key)}
            />
            <button
              type="button"
              className="strudel-grid__corner"
              aria-label={`Resize ${item.label}`}
              title="Drag to resize (arrow keys too)"
              onPointerDown={onCornerDown(item.key)}
              onPointerMove={onCornerMove}
              onPointerUp={onCornerUp}
              onPointerCancel={onCornerUp}
              onKeyDown={onCornerKey(item)}
            />
          </div>
        )
      })}
    </div>
  )
}

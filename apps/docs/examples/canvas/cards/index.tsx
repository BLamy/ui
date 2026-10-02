import { useState, type PointerEvent } from 'react'
import { Canvas, CanvasFrame, CanvasGuides, CanvasHandles, type CanvasPointerInfo } from '@/components/ui/canvas'
import {
  dist, frameHandles, handleCursor, inFrame, resizeFrame, rotateFrame, snapMove, toScreen,
  type Camera, type Frame, type Guide, type HandleId, type Rect,
} from '@/lib/canvas-math'

type Card = Frame & { id: string; label: string; tone: string }

const START: Card[] = [
  { id: 'a', label: 'Brief', x: 60, y: 60, w: 160, h: 100, rot: 0, tone: 'bg-primary/15' },
  { id: 'b', label: 'Sketch', x: 300, y: 90, w: 140, h: 140, rot: 8, tone: 'bg-success/20' },
  { id: 'c', label: 'Review', x: 120, y: 260, w: 200, h: 90, rot: 0, tone: 'bg-warning/25' },
]

type Drag =
  | { k: 'move'; id: string; start: { x: number; y: number }; orig: Card }
  | { k: 'resize'; id: string; handle: HandleId; start: { x: number; y: number }; orig: Card }
  | { k: 'rotate'; id: string; orig: Card }

// The canvas pans and zooms by itself. It hands you the pointer in board units, so this is all that is left.
export default function Cards() {
  const [camera, setCamera] = useState<Camera>({ x: 20, y: 10, z: 1 })
  const [cards, setCards] = useState(START)
  const [picked, setPicked] = useState<string | null>('b')
  const [guides, setGuides] = useState<Guide[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const [cursor, setCursor] = useState('default')

  const card = cards.find((c) => c.id === picked) ?? null
  const handles = card ? frameHandles(card, camera.z) : []
  const patch = (id: string, f: Partial<Card>) => setCards((all) => all.map((c) => (c.id === id ? { ...c, ...f } : c)))
  const handleAt = ({ screen }: CanvasPointerInfo) =>
    handles.find((h) => dist(toScreen(camera, h.pt), screen) <= 11)

  const down = (_: PointerEvent, info: CanvasPointerInfo) => {
    const h = handleAt(info)
    if (h && card) {
      setDrag(h.id === 'rot' ? { k: 'rotate', id: card.id, orig: card } : { k: 'resize', id: card.id, handle: h.id, start: info.board, orig: card })
      return
    }
    const hit = [...cards].reverse().find((c) => inFrame(info.board, c, 4 / camera.z))
    setPicked(hit?.id ?? null)
    if (hit) setDrag({ k: 'move', id: hit.id, start: info.board, orig: hit })
  }

  const move = (e: PointerEvent, info: CanvasPointerInfo) => {
    if (!drag) {
      const h = handleAt(info)
      const over = cards.some((c) => inFrame(info.board, c, 4 / camera.z))
      setCursor(h ? handleCursor(h.id, card?.rot ?? 0) : over ? 'move' : 'default')
      return
    }
    const { board: p } = info
    if (drag.k === 'move') {
      const o = drag.orig
      let dx = p.x - drag.start.x, dy = p.y - drag.start.y
      const others: Rect[] = cards.filter((c) => c.id !== o.id)
      const snap = snapMove({ x: o.x + dx, y: o.y + dy, w: o.w, h: o.h }, others, 6 / camera.z)
      dx += snap.dx
      dy += snap.dy
      setGuides(snap.guides)
      patch(o.id, { x: o.x + dx, y: o.y + dy })
    } else if (drag.k === 'resize') {
      patch(drag.id, resizeFrame(drag.orig, drag.handle, drag.start, p, e.shiftKey))
    } else {
      patch(drag.id, { rot: rotateFrame(drag.orig, p, !e.shiftKey) })
    }
  }

  const up = () => {
    setDrag(null)
    setGuides([])
  }

  return (
    <div className="relative h-[420px] overflow-hidden rounded-card shadow-hairline">
      <Canvas
        camera={camera}
        onCameraChange={setCamera}
        cursor={cursor}
        aria-label="Cards on a canvas"
        onCanvasPointerDown={down}
        onCanvasPointerMove={move}
        onCanvasPointerUp={up}
        overlay={
          <p className="pointer-events-none absolute bottom-2 left-3 m-0 text-footnote text-foreground">
            Scroll to pan · pinch or ⌘-scroll to zoom · hold Space to drag the view · ⌘0 fits
          </p>
        }
      >
        {cards.map((c) => (
          <div
            key={c.id}
            data-card={c.id}
            className={`absolute grid place-items-center rounded-card text-body font-semibold text-foreground shadow-hairline ${c.tone}`}
            style={{ left: c.x, top: c.y, width: c.w, height: c.h, transform: c.rot ? `rotate(${c.rot}deg)` : undefined }}
          >
            {c.label}
          </div>
        ))}
        {card ? <CanvasFrame frame={card} /> : null}
        <CanvasHandles handles={handles} />
        <CanvasGuides guides={guides} />
      </Canvas>
    </div>
  )
}

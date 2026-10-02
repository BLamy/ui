import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { useContainerSize, useContainerWidth } from '@/lib/container'

const CARDS = ['Inbox', 'Drafts', 'Sent', 'Archive', 'Trash', 'Spam']

// useContainerWidth measures the box it is ref'd to, not the viewport, so the
// layout answers to the room it has: here the number of columns. The frame's
// own width comes from the slider, standing in for a resizable pane.
function Cards() {
  const [ref, width] = useContainerWidth<HTMLDivElement>()
  const columns = width < 240 ? 1 : width < 340 ? 2 : 3
  return (
    <div
      ref={ref}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {CARDS.map((name) => (
        <div key={name} className="rounded-ctl bg-secondary px-3 py-2 text-footnote text-foreground">
          {name}
        </div>
      ))}
    </div>
  )
}

export default function ContainerSize() {
  const [frameWidth, setFrameWidth] = useState(360)
  // useContainerSize reports width and height of the same kind of box.
  const [frameRef, size] = useContainerSize<HTMLDivElement>()
  return (
    <div className="mx-auto grid max-w-md gap-4">
      <Slider
        label="Frame width"
        minValue={160}
        maxValue={420}
        step={10}
        value={frameWidth}
        onChange={(v) => setFrameWidth(v as number)}
      />
      <div
        ref={frameRef}
        className="grid max-w-full gap-3 overflow-hidden rounded-card border border-border bg-card p-3"
        style={{ width: frameWidth }}
      >
        <div className="text-footnote text-foreground tabular-nums">
          useContainerSize: {Math.round(size.width)} × {Math.round(size.height)} (frame width {frameWidth})
        </div>
        <Cards />
      </div>
    </div>
  )
}

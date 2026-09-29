import { SplitViewNotesDemo, SplitViewResizableDemo } from '@brett_lamy/ui'

// SplitView measures its own box, so the frame is all it needs. Drag the
// handle: regular tiles both columns, medium floats the list over the editor,
// compact stacks them — the selected note and the list's scroll position
// survive every step.
const breakpoints = { medium: 470, regular: 620 }

export default function DragToResize() {
  return (
    <SplitViewResizableDemo
      initial={2000}
      min={320}
      height={480}
      breakpoints={breakpoints}
    >
      <SplitViewNotesDemo breakpoints={breakpoints} listWidth={240} />
    </SplitViewResizableDemo>
  )
}

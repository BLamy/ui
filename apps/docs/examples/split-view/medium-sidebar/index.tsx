import { useState } from 'react'
import { SplitViewResizableDemo, SplitViewSettingsDemo } from '@/components/blocks/split-view-demos/demos'

// defaultSidebarOpen gives each size class where its sidebar starts; the sidebar
// resets to it whenever the class changes, and onSidebarOpenChange reports that
// reset (reason "content-resize"), so a controlling parent simply mirrors it.
const breakpoints = { medium: 470, regular: 720 }

export default function MediumSidebar() {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div
        style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginBottom: 8 }}
      >
        Parent state: sidebar <b>{open ? 'open' : 'closed'}</b>
      </div>
      <SplitViewResizableDemo
        initial={700}
        min={320}
        height={440}
        breakpoints={breakpoints}
      >
        <SplitViewSettingsDemo
          breakpoints={breakpoints}
          sidebarBehavior="tile"
          defaultSidebarOpen={{ regular: true, medium: true }}
          sidebarOpen={open}
          onSidebarOpenChange={setOpen}
        />
      </SplitViewResizableDemo>
    </div>
  )
}

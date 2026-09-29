import { useState } from 'react'
import { SplitViewResizableDemo, SplitViewSettingsDemo } from '@brett_lamy/ui'

// sidebarVisibility gives each width class its own starting visibility; the
// sidebar resets to it whenever the class changes, and onSidebarVisibleChange
// reports that reset — so a controlling parent simply mirrors it.
const breakpoints = { medium: 470, regular: 720 }

export default function MediumSidebar() {
  const [visible, setVisible] = useState(true)
  return (
    <div>
      <div
        style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginBottom: 8 }}
      >
        Parent state: sidebar <b>{visible ? 'visible' : 'hidden'}</b>
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
          sidebarVisibility={{ regular: true, medium: true }}
          sidebarVisible={visible}
          onSidebarVisibleChange={setVisible}
        />
      </SplitViewResizableDemo>
    </div>
  )
}

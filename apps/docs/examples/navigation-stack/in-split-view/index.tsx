import { useState } from 'react'
import {
  NavigationStack,
  SplitView,
  SplitViewContent,
  SplitViewDetail,
  SplitViewHeader,
  SplitViewItem,
  SplitViewSidebar,
  type Screen,
} from '@brett_lamy/ui'

/**
 * A NavigationStack in a SplitView's detail column. Collapsed (a phone-width
 * frame), its root screen shows a back button to the sidebar, labelled with the
 * sidebar's title — `rootBack` defaults to the previous column. Push a screen and
 * the stack pops itself first; at its root, back returns to the sidebar.
 */
export default function InSplitView() {
  const [keys, setKeys] = useState(['albums'])
  const screen = (key: string): Screen => ({
    key,
    title: key === 'albums' ? 'Albums' : 'Neon Tidewater',
    largeTitle: key === 'albums',
    content: (
      <div style={{ padding: '12px 16px', fontSize: 16 }}>
        {key === 'albums' ? (
          <button
            type="button"
            onClick={() => setKeys(['albums', 'album'])}
            style={{
              border: 0,
              padding: 0,
              background: 'transparent',
              color: 'var(--primary)',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Open Neon Tidewater
          </button>
        ) : (
          'Back pops this screen; at the root, back returns to the Library.'
        )}
      </div>
    ),
  })
  return (
    <div
      style={{
        position: 'relative',
        width: 390,
        height: 560,
        margin: '0 auto',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <SplitView
        aria-label="Music"
        defaultCompactColumn="detail"
        defaultSelection={{ sidebar: 'albums' }}
      >
        <SplitViewSidebar aria-label="Library">
          <SplitViewHeader title="Library" />
          <SplitViewContent style={{ padding: '8px 10px 0' }}>
            <SplitViewItem id="albums" title="Albums" />
          </SplitViewContent>
        </SplitViewSidebar>
        <SplitViewDetail aria-label="Albums">
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <NavigationStack
              screens={keys.map(screen)}
              onPop={() => setKeys((k) => k.slice(0, -1))}
            />
          </div>
        </SplitViewDetail>
      </SplitView>
    </div>
  )
}

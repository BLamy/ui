import { useState } from 'react'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLargeTitle,
  NavigationStackPage,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack'
import {
  SplitView,
  SplitViewContent,
  SplitViewDetail,
  SplitViewHeader,
  SplitViewItem,
  SplitViewSidebar,
} from '@/components/ui/split-view'

/**
 * A NavigationStack in a SplitView's detail column. Collapsed (a phone-width
 * frame), its first page shows a back button to the sidebar, labelled with the
 * sidebar's title — `rootBack` defaults to the previous column. Push a page and
 * the stack pops itself first; at its root, back returns to the sidebar.
 */
export default function InSplitView() {
  const [pages, setPages] = useState(['albums'])
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
        defaultValue={{ sidebar: 'albums' }}
      >
        <SplitViewSidebar aria-label="Library">
          <SplitViewHeader title="Library" />
          <SplitViewContent style={{ padding: '8px 10px 0' }}>
            <SplitViewItem value="albums" title="Albums" />
          </SplitViewContent>
        </SplitViewSidebar>
        <SplitViewDetail aria-label="Albums">
          <NavigationStack pages={pages} onPagesChange={setPages}>
            <NavigationStackPage value="albums">
              <NavigationStackBar>
                <NavigationStackTitle>Albums</NavigationStackTitle>
              </NavigationStackBar>
              <NavigationStackContent>
                <NavigationStackLargeTitle />
                <div style={{ padding: '12px 16px', fontSize: 16 }}>
                  <button
                    type="button"
                    onClick={() => setPages(['albums', 'album'])}
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
                </div>
              </NavigationStackContent>
            </NavigationStackPage>
            <NavigationStackPage value="album">
              <NavigationStackBar>
                <NavigationStackTitle>Neon Tidewater</NavigationStackTitle>
              </NavigationStackBar>
              <NavigationStackContent>
                <div style={{ padding: '12px 16px', fontSize: 16 }}>
                  Back pops this page; at the root, back returns to the Library.
                </div>
              </NavigationStackContent>
            </NavigationStackPage>
          </NavigationStack>
        </SplitViewDetail>
      </SplitView>
    </div>
  )
}

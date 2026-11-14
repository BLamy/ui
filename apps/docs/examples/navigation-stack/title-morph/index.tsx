import { useState, type ReactNode } from 'react'
import { List, ListRow, ListSection } from '@/components/ui/list'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLargeTitle,
  NavigationStackPage,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack'

// Titles of different lengths, so the back label shows each case: the full
// previous title, an ellipsized one, and "Back" once the centered title leaves
// only a sliver.
const TREE: Record<string, string[]> = {
  Settings: ['Notifications and Focus', 'General'],
  'Notifications and Focus': ['Scheduled Summary', 'Show Previews'],
  General: ['About', 'Background App Refresh While Charging'],
  'Scheduled Summary': [],
  'Show Previews': [],
  About: [],
  'Background App Refresh While Charging': [],
}

function Stack() {
  const [path, setPath] = useState<string[]>([])
  const page = (title: string, root = false) => (
    <NavigationStackPage key={title} value={title} grouped>
      <NavigationStackBar hideOnScroll={false}>
        <NavigationStackTitle>{title}</NavigationStackTitle>
      </NavigationStackBar>
      <NavigationStackContent>
        {root ? <NavigationStackLargeTitle /> : null}
        <List variant="inset">
          <ListSection
            footer={
              TREE[title].length
                ? 'Push a row: the title flies into the back button. Pop with ' +
                  'the button, Esc, or an edge swipe.'
                : 'The back label names the page behind — truncated, or ' +
                  '“Back”, when the title leaves no room.'
            }
          >
            {TREE[title].map((t, i) => (
              <ListRow
                key={t}
                title={t}
                accessory="chevron"
                onClick={() => setPath((p) => [...p, t])}
                divider={i < TREE[title].length - 1}
              />
            ))}
          </ListSection>
        </List>
      </NavigationStackContent>
    </NavigationStackPage>
  )
  return (
    <div style={{ position: 'relative', height: 360 }}>
      <NavigationStack
        pages={['Settings', ...path]}
        onPagesChange={(pages) => setPath(pages.slice(1))}
      >
        {page('Settings', true)}
        {path.map((t) => page(t))}
      </NavigationStack>
    </div>
  )
}

/**
 * The rounded, hairline-bordered window the example sits in, capped to a phone
 * width and centered.
 */
function Window({ width, children }: { width?: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function TitleMorph() {
  return (
    <Window width={390}>
      <Stack />
    </Window>
  )
}

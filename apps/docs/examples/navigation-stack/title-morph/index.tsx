import { useState, type ReactNode } from 'react'
import {
  List,
  ListRow,
  ListSection,
  NavigationStack,
  type Screen,
} from '@brett_lamy/ui'

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
  const screen = (title: string, root = false): Screen => ({
    key: title,
    title,
    largeTitle: root,
    grouped: true,
    hideChromeOnScroll: false,
    content: (
      <List inset>
        <ListSection
          footer={
            TREE[title].length
              ? 'Push a row: the title flies into the back button. Pop with ' +
                'the button, Esc, or an edge swipe.'
              : 'The back label names the screen behind — truncated, or ' +
                '“Back”, when the title leaves no room.'
          }
        >
          {TREE[title].map((t, i) => (
            <ListRow
              key={t}
              title={t}
              accessory="chevron"
              onPress={() => setPath((p) => [...p, t])}
              divider={i < TREE[title].length - 1}
            />
          ))}
        </ListSection>
      </List>
    ),
  })
  return (
    <div style={{ position: 'relative', height: 360 }}>
      <NavigationStack
        screens={[screen('Settings', true), ...path.map((t) => screen(t))]}
        onPop={() => setPath((p) => p.slice(0, -1))}
      />
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

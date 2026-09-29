import { useState, type ReactNode } from 'react'
import {
  Haptics,
  Icon,
  List,
  ListRow,
  ListSection,
  NavigationStack,
  type Screen,
} from '@brett_lamy/ui'

const teams = ['Design', 'Engineering', 'Research']

/**
 * A rounded, fixed-height frame; NavigationStack fills its positioned parent.
 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 330,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--muted)',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)',
      }}
    >
      {children}
    </div>
  )
}

export default function TeamsPush() {
  const [team, setTeam] = useState<string | null>(null)
  const screens: Screen[] = [
    {
      key: 'root',
      title: 'Teams',
      grouped: true,
      content: (
        <List inset>
          <ListSection>
            {teams.map((t, i) => (
              <ListRow
                key={t}
                leading={<Icon name="person" size={20} />}
                title={t}
                accessory="chevron"
                divider={i < teams.length - 1}
                onPress={() => {
                  Haptics.impact('light')
                  setTeam(t)
                }}
              />
            ))}
          </ListSection>
        </List>
      ),
    },
  ]
  // Push by adding a screen; the back chevron or an edge swipe calls onPop.
  if (team)
    screens.push({
      key: 'detail',
      title: team,
      grouped: true,
      content: (
        <div style={{ padding: '28px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 650 }}>{team}</div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--muted-foreground)',
              marginTop: 5,
              lineHeight: 1.5,
            }}
          >
            Pushed screen — use the back chevron, or drag from the left edge to
            pop interactively.
          </div>
        </div>
      ),
    })
  return (
    <Frame>
      <NavigationStack screens={screens} onPop={() => setTeam(null)} />
    </Frame>
  )
}

import { useState, type ReactNode } from 'react'
import { List, ListRow, ListSection } from '@/components/ui/list'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackPage,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack'
import { Icon } from '@/lib/icon'

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
  // The pages are keys: push by adding one, and the back chevron, Escape or an
  // edge swipe asks for one fewer through onPagesChange.
  return (
    <Frame>
      <NavigationStack
        pages={team ? ['root', 'detail'] : ['root']}
        onPagesChange={(pages) => {
          if (pages.length === 1) setTeam(null)
        }}
      >
        <NavigationStackPage value="root" variant="grouped">
          <NavigationStackBar>
            <NavigationStackTitle>Teams</NavigationStackTitle>
          </NavigationStackBar>
          <NavigationStackContent>
            <List variant="inset">
              <ListSection>
                {teams.map((t, i) => (
                  <ListRow
                    key={t}
                    icon={<Icon name="person" size={20} />}
                    title={t}
                    accessory="chevron"
                    divider={i < teams.length - 1}
                    onClick={() => setTeam(t)}
                  />
                ))}
              </ListSection>
            </List>
          </NavigationStackContent>
        </NavigationStackPage>
        {team ? (
          <NavigationStackPage value="detail" variant="grouped">
            <NavigationStackBar>
              <NavigationStackTitle>{team}</NavigationStackTitle>
            </NavigationStackBar>
            <NavigationStackContent>
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
                  Pushed page — use the back chevron, or drag from the left edge
                  to pop interactively.
                </div>
              </div>
            </NavigationStackContent>
          </NavigationStackPage>
        ) : null}
      </NavigationStack>
    </Frame>
  )
}

import { useState, type ReactNode } from 'react'
import { List, ListRow, ListSection } from '@/components/ui/list'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackPage,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack'
import { Switch } from '@/components/ui/switch'
import { Icon } from '@/lib/icon'

/** A grouped page with a title, its bar pinned. */
function Page({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <NavigationStackPage value={value} grouped>
      <NavigationStackBar hideOnScroll={false}>
        <NavigationStackTitle>{title}</NavigationStackTitle>
      </NavigationStackBar>
      <NavigationStackContent>{children}</NavigationStackContent>
    </NavigationStackPage>
  )
}

function SettingsDrillDown() {
  // The pages are keys in state: rows push by appending one, and the stack's
  // back button, Escape or an edge swipe hands back the shorter list. Every
  // page is declared; the stack shows the ones in `pages`.
  const [pages, setPages] = useState(['settings'])
  const [autoUpdate, setAutoUpdate] = useState(true)
  const push = (key: string) => setPages((p) => [...p, key])
  const detail = (label: string, value: string, last = false) => (
    <ListRow
      title={label}
      divider={!last}
      trailing={<span style={{ color: 'var(--muted-foreground)' }}>{value}</span>}
    />
  )
  return (
    <div style={{ position: 'relative', height: 420 }}>
      <NavigationStack pages={pages} onPagesChange={setPages}>
        <Page value="settings" title="Settings">
          <List inset>
            <ListSection>
              <ListRow
                leading={<Icon name="gear" size={22} />}
                title="General"
                accessory="chevron"
                onClick={() => push('general')}
              />
              <ListRow
                leading={<Icon name="lock" size={22} />}
                title="Privacy"
                accessory="chevron"
                divider={false}
                onClick={() => push('privacy')}
              />
            </ListSection>
          </List>
        </Page>
        <Page value="general" title="General">
          <List inset>
            <ListSection>
              <ListRow
                title="About"
                accessory="chevron"
                onClick={() => push('about')}
              />
              <ListRow
                title="Software Update"
                accessory="chevron"
                divider={false}
                onClick={() => push('update')}
              />
            </ListSection>
          </List>
        </Page>
        <Page value="privacy" title="Privacy">
          <List inset>
            <ListSection footer="Apps must ask before they use your location.">
              {detail('Location Services', 'On', true)}
            </ListSection>
          </List>
        </Page>
        <Page value="about" title="About">
          <List inset>
            <ListSection>
              {detail('Name', 'Ada’s iPhone')}
              {detail('Version', '26.1')}
              {detail('Model', 'iPhone 17 Pro', true)}
            </ListSection>
          </List>
        </Page>
        <Page value="update" title="Software Update">
          <List inset>
            <ListSection footer="Updates install overnight while charging.">
              <ListRow
                title="Automatic Updates"
                divider={false}
                trailing={
                  <Switch
                    aria-label="Automatic Updates"
                    checked={autoUpdate}
                    onCheckedChange={setAutoUpdate}
                  />
                }
              />
            </ListSection>
          </List>
        </Page>
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

export default function SettingsDrillDownExample() {
  return (
    <Window width={430}>
      <SettingsDrillDown />
    </Window>
  )
}

import { useState, type ReactNode } from 'react'
import {
  Icon,
  List,
  ListRow,
  ListSection,
  NavigationStack,
  Switch,
  type Screen,
} from '@brett_lamy/ui'

function SettingsDrillDown() {
  // The path is the stack: push by appending, pop by dropping the last entry.
  const [path, setPath] = useState<string[]>([])
  const [autoUpdate, setAutoUpdate] = useState(true)
  const push = (key: string) => setPath((p) => [...p, key])
  const detail = (label: string, value: string, last = false) => (
    <ListRow
      title={label}
      divider={!last}
      trailing={<span style={{ color: 'var(--bl-label2)' }}>{value}</span>}
    />
  )
  const screens: Screen[] = [
    {
      key: 'settings',
      title: 'Settings',
      grouped: true,
      hideChromeOnScroll: false,
      content: (
        <List inset>
          <ListSection>
            <ListRow
              leading={<Icon name="gear" size={22} />}
              title="General"
              accessory="chevron"
              onPress={() => push('general')}
            />
            <ListRow
              leading={<Icon name="lock" size={22} />}
              title="Privacy"
              accessory="chevron"
              divider={false}
              onPress={() => push('privacy')}
            />
          </ListSection>
        </List>
      ),
    },
  ]
  for (const key of path) {
    if (key === 'general')
      screens.push({
        key,
        title: 'General',
        grouped: true,
        hideChromeOnScroll: false,
        content: (
          <List inset>
            <ListSection>
              <ListRow title="About" accessory="chevron" onPress={() => push('about')} />
              <ListRow
                title="Software Update"
                accessory="chevron"
                divider={false}
                onPress={() => push('update')}
              />
            </ListSection>
          </List>
        ),
      })
    if (key === 'privacy')
      screens.push({
        key,
        title: 'Privacy',
        grouped: true,
        hideChromeOnScroll: false,
        content: (
          <List inset>
            <ListSection footer="Apps must ask before they use your location.">
              {detail('Location Services', 'On', true)}
            </ListSection>
          </List>
        ),
      })
    if (key === 'about')
      screens.push({
        key,
        title: 'About',
        grouped: true,
        hideChromeOnScroll: false,
        content: (
          <List inset>
            <ListSection>
              {detail('Name', 'Ada’s iPhone')}
              {detail('Version', '26.1')}
              {detail('Model', 'iPhone 17 Pro', true)}
            </ListSection>
          </List>
        ),
      })
    if (key === 'update')
      screens.push({
        key,
        title: 'Software Update',
        grouped: true,
        hideChromeOnScroll: false,
        content: (
          <List inset>
            <ListSection footer="Updates install overnight while charging.">
              <ListRow
                title="Automatic Updates"
                divider={false}
                trailing={
                  <Switch
                    aria-label="Automatic Updates"
                    checked={autoUpdate}
                    onChange={setAutoUpdate}
                  />
                }
              />
            </ListSection>
          </List>
        ),
      })
  }
  return (
    <div style={{ position: 'relative', height: 420 }}>
      <NavigationStack screens={screens} onPop={() => setPath((p) => p.slice(0, -1))} />
    </div>
  )
}

/** The rounded, hairline-bordered window the example sits in, capped to a phone width and centered. */
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
        background: 'var(--bl-bg)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
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

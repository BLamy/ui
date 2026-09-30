import { useState, type ReactNode } from 'react'
import { Icon, List, ListRow, ListSection, Switch } from '@brett_lamy/ui'

function Tile({ icon, color }: { icon: string; color: string }) {
  return (
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 29,
        height: 29,
        borderRadius: 7,
        background: color,
        color: '#fff',
      }}
    >
      <Icon name={icon} size={18} sw={2} />
    </span>
  )
}

function SettingsList() {
  const [airplane, setAirplane] = useState(false)
  const [dnd, setDnd] = useState(true)
  const value = (text: string) => (
    <span style={{ color: 'var(--muted-foreground)', fontSize: 16 }}>{text}</span>
  )
  return (
    <div style={{ padding: '18px 0' }}>
      <List inset>
        <ListSection>
          <ListRow
            leading={<Tile icon="drop" color="#FF9500" />}
            title="Airplane Mode"
            trailing={
              <Switch
                aria-label="Airplane Mode"
                checked={airplane}
                onChange={setAirplane}
              />
            }
          />
          <ListRow
            leading={<Tile icon="wifi" color="#0A84FF" />}
            title="Wi-Fi"
            trailing={value(airplane ? 'Off' : 'Home')}
            accessory="chevron"
            onPress={() => {}}
          />
          <ListRow
            leading={<Tile icon="link" color="#0A84FF" />}
            title="Bluetooth"
            trailing={value('On')}
            accessory="chevron"
            divider={false}
            onPress={() => {}}
          />
        </ListSection>
        <ListSection
          footer={'Silences calls and notifications while Focus ' + 'is on.'}
        >
          <ListRow
            leading={<Tile icon="bell" color="#FF3B30" />}
            title="Notifications"
            accessory="chevron"
            onPress={() => {}}
          />
          <ListRow
            leading={<Tile icon="wave" color="#FF2D55" />}
            title="Sounds"
            accessory="chevron"
            onPress={() => {}}
          />
          <ListRow
            leading={<Tile icon="moon" color="#5E5CE6" />}
            title="Do Not Disturb"
            divider={false}
            trailing={
              <Switch
                aria-label="Do Not Disturb"
                checked={dnd}
                onChange={setDnd}
              />
            }
          />
        </ListSection>
      </List>
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it,
// centered.
function Window({
  width,
  bg = 'var(--background)',
  children,
}: {
  width?: number
  bg?: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: bg,
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function Settings() {
  return (
    <Window width={430} bg="var(--muted)">
      <SettingsList />
    </Window>
  )
}

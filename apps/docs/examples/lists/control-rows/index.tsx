import { useState, type ReactNode } from 'react'
import {
  Button,
  Icon,
  List,
  ListRow,
  ListSection,
  Slider,
  Switch,
} from '@brett_lamy/ui'

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

function Controls() {
  const [bluetooth, setBluetooth] = useState(true)
  const [haptics, setHaptics] = useState(true)
  const [volume, setVolume] = useState(60)
  const [queued, setQueued] = useState(0)
  return (
    <div style={{ padding: '18px 0' }}>
      <List inset>
        {/* No onPress: each row is a plain container, the Switch is the
            control, and pressing the row's label flips it. The Switch is named
            by the row title. */}
        <ListSection footer="Tap anywhere on a row to flip its switch.">
          <ListRow
            leading={<Tile icon="link" color="#0A84FF" />}
            title="Bluetooth"
            accessory={<Switch checked={bluetooth} onChange={setBluetooth} />}
          />
          <ListRow
            leading={<Tile icon="wave" color="#FF2D55" />}
            title="System Haptics"
            divider={false}
            accessory={<Switch checked={haptics} onChange={setHaptics} />}
          />
        </ListSection>
        <ListSection title="Sounds">
          <ListRow
            title="Volume"
            divider={false}
            accessory={
              <Slider
                value={volume}
                onChange={(v) => setVolume(v as number)}
                style={{ width: 170 }}
              />
            }
          />
        </ListSection>
        {/* onPress and a Button together: the row button sits beneath the
            content, so the two are siblings, never nested. */}
        <ListSection>
          <ListRow
            leading={<Tile icon="doc" color="#34C759" />}
            title="Field Guide"
            subtitle={queued ? `${queued} queued` : 'Offline copy'}
            onPress={() => {}}
            divider={false}
            accessory={
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setQueued((n) => n + 1)}
              >
                Get
              </Button>
            }
          />
        </ListSection>
      </List>
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it,
// centered.
function Window({ width, children }: { width?: number; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bl-bg2)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function ControlRows() {
  return (
    <Window width={430}>
      <Controls />
    </Window>
  )
}

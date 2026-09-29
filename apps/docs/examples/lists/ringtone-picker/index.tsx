import { useState, type ReactNode } from 'react'
import { List, ListRow, ListSection } from '@brett_lamy/ui'

const tones = ['Radar', 'Apex', 'Chimes', 'Signal', 'Silk']

function RingtonePicker() {
  const [tone, setTone] = useState('Radar')
  const [signedIn, setSignedIn] = useState(true)
  return (
    <div style={{ padding: '18px 0' }}>
      <List inset>
        <ListSection
          title="Ringtone"
          footer="The checked tone plays for calls from everyone."
        >
          {tones.map((t, i) => (
            <ListRow
              key={t}
              title={t}
              accessory="check"
              checked={t === tone}
              divider={i < tones.length - 1}
              onPress={() => setTone(t)}
            />
          ))}
        </ListSection>
        <ListSection>
          <ListRow
            center
            destructive={signedIn}
            divider={false}
            title={signedIn ? 'Sign Out' : 'Sign In'}
            onPress={() => setSignedIn(!signedIn)}
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
  bg = 'var(--bl-bg)',
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
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function Ringtones() {
  return (
    <Window width={430} bg="var(--bl-bg2)">
      <RingtonePicker />
    </Window>
  )
}

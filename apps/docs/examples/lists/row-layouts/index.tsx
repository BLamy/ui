import { useState } from 'react'
import { Icon, List, ListRow, ListSection, Slider, Switch } from '@brett_lamy/ui'

/** Your own switch component: ListRow still names it after the row title. */
function SettingSwitch(props: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center' }}>
      <Switch checked={props.on} onChange={props.onChange} />
    </span>
  )
}

export default function RowLayouts() {
  const [done, setDone] = useState(false)
  const [brightness, setBrightness] = useState(40)
  const [shake, setShake] = useState(true)
  const [mailbox, setMailbox] = useState('inbox')
  return (
    <div
      style={{
        maxWidth: 430,
        margin: '0 auto',
        padding: '18px 0',
        borderRadius: 14,
        background: 'var(--muted)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <List inset>
        {/* align="top": the circle sits on the first line of a wrapping title. */}
        <ListSection title="Top-aligned leading">
          <ListRow
            align="top"
            onPress={() => setDone((d) => !d)}
            leading={
              <span
                style={{
                  width: 22,
                  height: 22,
                  boxSizing: 'border-box',
                  borderRadius: 11,
                  border: done
                    ? '1.6px solid var(--primary)'
                    : '1.6px solid var(--tertiary-foreground)',
                  background: done ? 'var(--primary)' : 'transparent',
                }}
              />
            }
            title={
              <span style={{ display: 'block', whiteSpace: 'normal' }}>
                Book the cabin ferry for the long weekend, and check whether
                dogs ride free
              </span>
            }
            subtitle="Friday, 9:00"
            divider={false}
          />
        </ListSection>
        {/* children: a control that spans the whole row. */}
        <ListSection title="Full-width control">
          <ListRow divider={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sun" size={18} style={{ color: 'var(--muted-foreground)' }} />
              <Slider
                aria-label="Brightness"
                value={brightness}
                onChange={(v) => setBrightness(v as number)}
                style={{ flex: 1 }}
              />
              <Icon name="sun" size={24} style={{ color: 'var(--muted-foreground)' }} />
            </div>
          </ListRow>
        </ListSection>
        {/* A wrapped Switch is labelled by the row title; pressing the row flips it. */}
        <ListSection title="Wrapped switch">
          <ListRow
            title="Shake to Undo"
            divider={false}
            accessory={<SettingSwitch on={shake} onChange={setShake} />}
          />
        </ListSection>
        {/* selected rows carry aria-current. */}
        <ListSection title="Selection">
          {['Inbox', 'Archive'].map((m, i) => (
            <ListRow
              key={m}
              title={m}
              selected={mailbox === m.toLowerCase()}
              onPress={() => setMailbox(m.toLowerCase())}
              divider={i === 0}
            />
          ))}
        </ListSection>
      </List>
    </div>
  )
}

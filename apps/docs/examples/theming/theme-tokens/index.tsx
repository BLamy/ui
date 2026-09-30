import { useState } from 'react'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { Switch } from '@/components/ui/switch'
import { Icon } from '@/lib/icon'
import { BLProvider, useAppearance } from '@/lib/theme'

const tints = ['#0A84FF', '#5E5CE6', '#34C759', '#FF9F0A', '#FF375F']

// BLProvider sets the theme variables (--primary for the tint, the light/dark
// class) that every component below it reads.
export default function Appearance() {
  const [dark, setDark] = useState(useAppearance() === 'dark')
  const [tint, setTint] = useState('#0A84FF')
  return (
    <div
      style={{
        maxWidth: 430,
        height: 250,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <BLProvider dark={dark} tint={tint}>
        <div style={{ padding: 16 }}>
          <div
            style={{
              display: 'flex',
              gap: 9,
              marginBottom: 12,
              justifyContent: 'center',
            }}
          >
            {tints.map((c) => (
              <button
                key={c}
                onClick={() => setTint(c)}
                aria-label={'Tint ' + c}
                style={{
                  width: 23,
                  height: 23,
                  borderRadius: '50%',
                  background: c,
                  cursor: 'pointer',
                  padding: 0,
                  border: '1px solid rgba(0,0,0,.1)',
                  outline: tint === c ? '2.5px solid ' + c : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <List inset>
            <ListSection title="Appearance">
              <ListRow
                leading={<Icon name="bell" size={20} />}
                title="Dark Mode"
                divider={false}
                trailing={
                  <Switch
                    aria-label="Dark Mode"
                    checked={dark}
                    onChange={setDark}
                  />
                }
              />
            </ListSection>
          </List>
          {/* A plain button reading the tint token */}
          <button
            style={{
              display: 'block',
              margin: '12px auto 0',
              border: 0,
              borderRadius: 10,
              background: 'var(--primary)',
              color: '#fff',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 13.5,
              padding: '9px 16px',
              cursor: 'pointer',
            }}
          >
            Tinted action
          </button>
        </div>
      </BLProvider>
    </div>
  )
}

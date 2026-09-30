import { useState, type CSSProperties } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { Switch } from '@/components/ui/switch'
import { BLProvider, useAppearance } from '@/lib/theme'

// A brand palette defined for both appearances: override any --bl-* token.
const sepia: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    '--muted': '#F4ECDD',
    '--card': '#FBF6EC',
    '--foreground': '#3B2F20',
    '--muted-foreground': 'rgba(59,47,32,.62)',
    '--border': 'rgba(59,47,32,.16)',
    '--secondary': 'rgba(122,94,56,.12)',
  },
  dark: {
    '--muted': '#1C1712',
    '--card': '#28211A',
    '--foreground': '#F1E6D2',
    '--muted-foreground': 'rgba(241,230,210,.6)',
    '--border': 'rgba(241,230,210,.14)',
    '--secondary': 'rgba(241,230,210,.1)',
  },
}

export default function SepiaReader() {
  const appearance = useAppearance() ?? 'light'
  const [serif, setSerif] = useState(true)
  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <BLProvider
        tint="#B8742A"
        style={{
          ...(sepia[appearance] as CSSProperties),
          height: 'auto',
          borderRadius: 14,
        }}
      >
        <div style={{ padding: '16px 0 0' }}>
          <List inset>
            <ListSection title="Reading">
              <ListRow
                leading={<Avatar c={{ f: 'Jane', l: 'Austen' }} size={34} />}
                title="Pride and Prejudice"
                subtitle="Chapter 3 · 42% read"
                accessory="chevron"
                onPress={() => {}}
              />
              <ListRow
                title="Serif font"
                divider={false}
                trailing={
                  <Switch
                    aria-label="Serif font"
                    checked={serif}
                    onChange={setSerif}
                  />
                }
              />
            </ListSection>
          </List>
          <p
            style={{
              margin: '0 20px 18px',
              lineHeight: 1.6,
              fontSize: 15,
              fontFamily: serif ? 'Georgia, serif' : undefined,
            }}
          >
            It is a truth universally acknowledged, that a single man in
            possession of a good fortune, must be in want of a wife.
          </p>
        </div>
      </BLProvider>
    </div>
  )
}

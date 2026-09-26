/* Theming page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState, type CSSProperties } from 'react'
import {
  Avatar,
  BLProvider,
  Badge,
  Button,
  Icon,
  List,
  ListRow,
  ListSection,
  Segmented,
  Slider,
  Switch,
  useAppearance,
} from '@brett_lamy/ui'
import raw from './theming.tsx?raw'
import { examples } from './chrome'

// #region theme_tints
const accents = [
  { name: 'Blue', tint: '#0A84FF' },
  { name: 'Indigo', tint: '#5E5CE6' },
  { name: 'Green', tint: '#34C759' },
  { name: 'Pink', tint: '#FF375F' },
]

function Sample({ name }: { name: string }) {
  const [on, setOn] = useState(true)
  const [plan, setPlan] = useState('pro')
  return (
    <div style={{ display: 'grid', gap: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1 }}>{name}</strong>
        <Badge variant="tinted">New</Badge>
      </div>
      <Segmented
        aria-label="Plan"
        value={plan}
        onChange={setPlan}
        options={[
          { id: 'free', label: 'Free' },
          { id: 'pro', label: 'Pro' },
        ]}
      />
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ fontSize: 14 }}>Sync</span>
        <Switch aria-label="Sync" checked={on} onChange={setOn} />
      </div>
      <Button size="sm">Upgrade</Button>
    </div>
  )
}

export function TintGallery() {
  // One tint prop re-accents everything below it; appearance follows the host.
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
      }}
    >
      {accents.map((a) => (
        <BLProvider
          key={a.name}
          tint={a.tint}
          style={{ height: 'auto', borderRadius: 14, boxShadow: '0 0 0 1px var(--bl-sep)' }}
        >
          <Sample name={a.name} />
        </BLProvider>
      ))}
    </div>
  )
}
// #endregion

// #region theme_scoped
export function NowPlaying() {
  const [volume, setVolume] = useState(60)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* Nested providers win: these two cards ignore the page's appearance */}
      {[false, true].map((dark) => (
        <BLProvider
          key={String(dark)}
          dark={dark}
          tint="#FF375F"
          style={{ height: 'auto', borderRadius: 18 }}
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: 16,
              background: 'var(--bl-card)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #FF375F, #FF9F0A)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>Midnight City</div>
              <div style={{ fontSize: 13, color: 'var(--bl-label2)' }}>
                M83 · {dark ? 'dark' : 'light'}
              </div>
              <Slider
                aria-label="Volume"
                value={volume}
                onChange={setVolume}
                style={{ marginTop: 8 }}
              />
            </div>
            <Button size="icon" aria-label="Like">
              <Icon name="heart" size={18} />
            </Button>
          </div>
        </BLProvider>
      ))}
    </div>
  )
}
// #endregion

// #region theme_custom
// A brand palette defined for both appearances: override any --bl-* token.
const sepia: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    '--bl-bg2': '#F4ECDD',
    '--bl-card': '#FBF6EC',
    '--bl-label': '#3B2F20',
    '--bl-label2': 'rgba(59,47,32,.62)',
    '--bl-sep': 'rgba(59,47,32,.16)',
    '--bl-fill': 'rgba(122,94,56,.12)',
  },
  dark: {
    '--bl-bg2': '#1C1712',
    '--bl-card': '#28211A',
    '--bl-label': '#F1E6D2',
    '--bl-label2': 'rgba(241,230,210,.6)',
    '--bl-sep': 'rgba(241,230,210,.14)',
    '--bl-fill': 'rgba(241,230,210,.1)',
  },
}

export function SepiaReader() {
  const appearance = useAppearance() ?? 'light'
  const [serif, setSerif] = useState(true)
  return (
    <BLProvider
      tint="#B8742A"
      style={{ ...(sepia[appearance] as CSSProperties), height: 'auto', borderRadius: 14 }}
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
                <Switch aria-label="Serif font" checked={serif} onChange={setSerif} />
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
          It is a truth universally acknowledged, that a single man in possession of a good
          fortune, must be in want of a wife.
        </p>
      </div>
    </BLProvider>
  )
}
// #endregion

export const THEMING_LIVE = examples(raw, [
  {
    id: 'theme_tints',
    title: 'One tint prop per subtree',
    h: 260,
    Render: () => <TintGallery />,
  },
  {
    id: 'theme_scoped',
    title: 'Scoped appearance · nested providers',
    h: 140,
    Render: () => <NowPlaying />,
  },
  {
    id: 'theme_custom',
    title: 'A custom palette for light and dark',
    h: 300,
    Render: () => (
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <SepiaReader />
      </div>
    ),
  },
])

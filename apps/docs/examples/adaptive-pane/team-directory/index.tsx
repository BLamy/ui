import { useState, type ReactNode } from 'react'
import {
  AdaptivePane,
  Avatar,
  Button,
  List,
  ListRow,
  ListSection,
  useContainerWidth,
  type AdaptivePaneMode,
} from '@brett_lamy/ui'

const team = [
  { f: 'Maya', l: 'Lindqvist', role: 'Industrial design' },
  { f: 'Jonas', l: 'Ito', role: 'Haptics engineering' },
  { f: 'Priya', l: 'Raman', role: 'Research' },
]

function TeamDirectory() {
  const [ref, width] = useContainerWidth()
  const [sel, setSel] = useState<(typeof team)[number] | null>(team[0])
  const compact = width < 600
  // Wide: the detail is a column beside the list. Compact: it covers the list
  // until you close it.
  const mode: AdaptivePaneMode = compact ? (sel ? 'cover' : 'hidden') : 'column'
  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        height: 340,
        background: 'var(--bl-bg2)',
      }}
    >
      <main style={{ flex: 1, minWidth: 0, paddingTop: 14 }}>
        <List inset>
          <ListSection title="Team">
            {team.map((p, i) => (
              <ListRow
                key={p.l}
                leading={<Avatar c={p} size={34} />}
                title={`${p.f} ${p.l}`}
                accessory="chevron"
                selected={!compact && sel === p}
                divider={i < team.length - 1}
                onPress={() => setSel(p)}
              />
            ))}
          </ListSection>
        </List>
      </main>
      <AdaptivePane
        mode={mode}
        side="right"
        columnWidth={260}
        zIndex={10}
        columnStyle={{ borderLeft: '1px solid var(--bl-sep)' }}
      >
        <div
          style={{
            height: '100%',
            padding: 20,
            boxSizing: 'border-box',
            background: 'var(--bl-bg)',
            textAlign: 'center',
          }}
        >
          {compact && (
            <Button
              variant="link"
              style={{ display: 'block' }}
              onPress={() => setSel(null)}
            >
              ‹ Team
            </Button>
          )}
          {sel ? (
            <>
              <Avatar c={sel} size={72} style={{ margin: '14px auto 10px' }} />
              <div style={{ fontSize: 19, fontWeight: 700 }}>
                {sel.f} {sel.l}
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: 'var(--bl-label2)',
                  marginTop: 4,
                }}
              >
                {sel.role}
              </div>
            </>
          ) : (
            <div style={{ marginTop: 40, color: 'var(--bl-label2)' }}>
              Select a person
            </div>
          )}
        </div>
      </AdaptivePane>
    </div>
  )
}

// The host width each variant previews; wide fills the card.
const widths: Record<string, number | undefined> = {
  wide: undefined,
  narrow: 390,
}

export default function ColumnOrCover({
  variant = 'wide',
}: {
  variant?: string
}) {
  return (
    <Window width={widths[variant]}>
      {/* remount per width so the selection resets */}
      <TeamDirectory key={variant} />
    </Window>
  )
}

/**
 * A rounded window with the page background; `width` caps it (phone-sized
 * examples), centered.
 */
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

import { useState, type ReactNode } from 'react'
import { AdaptivePane, type AdaptivePanePresentation } from '@/components/ui/adaptive-pane'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { useContainerWidth } from '@/lib/container'

const team = [
  { f: 'Maya', l: 'Lindqvist', role: 'Industrial design' },
  { f: 'Jonas', l: 'Ito', role: 'Motion engineering' },
  { f: 'Priya', l: 'Raman', role: 'Research' },
]

function TeamDirectory() {
  const [ref, width] = useContainerWidth()
  const [sel, setSel] = useState<(typeof team)[number] | null>(team[0])
  const compact = width < 600
  // Wide: the detail is a column beside the list. Compact: it covers the list
  // until you close it.
  const mode: AdaptivePanePresentation = compact ? 'cover' : 'column'
  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        height: 340,
        background: 'var(--muted)',
      }}
    >
      <main style={{ flex: 1, minWidth: 0, paddingTop: 14 }}>
        <List variant="inset">
          <ListSection title="Team">
            {team.map((p, i) => (
              <ListRow
                key={p.l}
                icon={<Avatar name={`${p.f} ${p.l}`} size={34} />}
                title={`${p.f} ${p.l}`}
                accessory="chevron"
                current={!compact && sel === p}
                divider={i < team.length - 1}
                onClick={() => setSel(p)}
              />
            ))}
          </ListSection>
        </List>
      </main>
      <AdaptivePane
        presentation={mode}
        side="end"
        // Wide, the detail always shows; compact, it covers the list while
        // someone is selected.
        open={!compact || sel !== null}
        onOpenChange={(open) => !open && setSel(null)}
        columnWidth={260}
        zIndex={10}
        className="border-s border-border"
      >
        <div
          style={{
            height: '100%',
            padding: 20,
            boxSizing: 'border-box',
            background: 'var(--background)',
            textAlign: 'center',
          }}
        >
          {compact && (
            <Button
              variant="link"
              style={{ display: 'block' }}
              onClick={() => setSel(null)}
            >
              ‹ Team
            </Button>
          )}
          {sel ? (
            <>
              <Avatar name={`${sel.f} ${sel.l}`} size={72} style={{ margin: '14px auto 10px' }} />
              <div style={{ fontSize: 19, fontWeight: 700 }}>
                {sel.f} {sel.l}
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: 'var(--muted-foreground)',
                  marginTop: 4,
                }}
              >
                {sel.role}
              </div>
            </>
          ) : (
            <div style={{ marginTop: 40, color: 'var(--muted-foreground)' }}>
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

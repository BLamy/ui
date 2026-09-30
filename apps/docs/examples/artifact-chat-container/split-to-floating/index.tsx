import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArtifactChatContainer } from '@/components/ui/artifact-chat-container'
import { Composer, ComposerAttach, ComposerAttachments, ComposerCard, ComposerExpand, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer'

const messages = [
  ['You', 'Compare conversion by region.'],
  ['BL UI', 'I added the regional breakdown. West is leading at 34%.'],
  ['You', 'Which region moved most against last month?'],
  ['BL UI', 'Northeast — up 6.1 points. I highlighted it in the chart.'],
  ['You', 'Call out the largest change.'],
]
const stats = [
  ['Revenue', '$1.84M'],
  ['Conversion', '28.4%'],
  ['Retention', '91.2%'],
]
const bars = [55, 92, 68, 44, 78]
const regions = [
  ['Northeast', '34.1%', '+6.1'],
  ['West', '31.8%', '+2.4'],
  ['Midwest', '27.2%', '-0.8'],
  ['South', '24.6%', '+1.2'],
]

/**
 * Lays a fixed-size composition out at its design width, scaled down (never up)
 * to fit, centered.
 */
function Scaled({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: ReactNode
}) {
  const host = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const resize = () => setScale(Math.min(1, el.clientWidth / width))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  return (
    <div
      ref={host}
      style={{
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        height: height * scale,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Transcript() {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '18px 18px 14px',
        background: '#131318',
        color: '#EDEDF2',
      }}
    >
      {messages.map(([author, copy], index) => (
        <div key={copy} style={{ marginBottom: 18 }}>
          <div
            style={{
              color: index % 2 ? '#68A7FF' : 'rgba(235,235,245,.6)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {author}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
            {copy}
          </div>
        </div>
      ))}
    </div>
  )
}

function Artifact({ compact }: { compact: boolean }) {
  return (
    <div
      style={{
        minHeight: '100%',
        boxSizing: 'border-box',
        padding: compact ? 20 : 28,
        background: '#F6F7FA',
        color: '#15161A',
      }}
    >
      <div
        style={{
          color: '#777B84',
          fontSize: 11,
          fontWeight: 750,
          letterSpacing: '.08em',
        }}
      >
        LIVE ARTIFACT
      </div>
      <h2 style={{ fontSize: compact ? 23 : 28, margin: '8px 0 22px' }}>
        Quarterly performance
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
          gap: 10,
        }}
      >
        {stats.map(([label, value]) => (
          <div
            key={label}
            style={{
              minWidth: 0,
              border: '1px solid #E1E3E8',
              borderRadius: 13,
              padding: compact ? 11 : 17,
              background: '#fff',
            }}
          >
            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: '#777B84',
                fontSize: 11,
              }}
            >
              {label}
            </div>
            <strong
              style={{
                display: 'block',
                marginTop: 7,
                fontSize: compact ? 15 : 21,
              }}
            >
              {value}
            </strong>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          height: 235,
          border: '1px solid #E1E3E8',
          borderRadius: 13,
          padding: 17,
          background: '#fff',
        }}
      >
        <strong style={{ fontSize: 14 }}>Conversion by region</strong>
        <div
          style={{
            height: 180,
            display: 'flex',
            alignItems: 'end',
            gap: 14,
            paddingTop: 12,
          }}
        >
          {bars.map((height, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: `${height}%`,
                borderRadius: '6px 6px 2px 2px',
                background: index === 1 ? '#0A84FF' : '#B7D7FF',
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          border: '1px solid #E1E3E8',
          borderRadius: 13,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        {regions.map(([region, rate, delta], index) => (
          <div
            key={region}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 17px',
              borderTop: index ? '1px solid #EEF0F4' : 0,
              fontSize: 13,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>{region}</span>
            <strong>{rate}</strong>
            <span
              style={{
                width: 42,
                textAlign: 'right',
                color: delta.startsWith('-') ? '#C7362F' : '#1B873F',
              }}
            >
              {delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Above the breakpoint the chat is a docked column; below it, a floating sheet
// over the artifact.
export default function SplitToFloating({
  variant = 'wide',
}: {
  variant?: string
}) {
  const [working, setWorking] = useState(false)
  const compact = variant === 'compact'
  return (
    <div>
      <Scaled width={compact ? 430 : 1040} height={555}>
        <div
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            borderRadius: 12,
          }}
        >
          <ArtifactChatContainer
            breakpoint={760}
            working={working}
            workingLabel="Working on the artifact…"
            onAdd={() => setWorking(false)}
          >
            <ArtifactChatContainer.Chat>
              <Transcript />
            </ArtifactChatContainer.Chat>
            <ArtifactChatContainer.Composer>
              <div style={{ padding: 8, background: 'transparent' }}>
                <Composer onSubmit={() => setWorking(true)}>
                  <ComposerCard>
                    <ComposerExpand />
                    <ComposerAttachments />
                    <ComposerInput placeholder="Do anything" />
                    <ComposerFooter>
                      <ComposerAttach />
                      <ComposerSpacer />
                      <ComposerSend />
                    </ComposerFooter>
                  </ComposerCard>
                </Composer>
              </div>
            </ArtifactChatContainer.Composer>
            <ArtifactChatContainer.Content>
              <Artifact compact={compact} />
            </ArtifactChatContainer.Content>
          </ArtifactChatContainer>
        </div>
      </Scaled>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setWorking((value) => !value)}
          style={{
            border: 0,
            background: 'none',
            color: 'var(--primary)',
            font: 'inherit',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {working ? 'Show composer state' : 'Preview working state'}
        </button>
      </div>
    </div>
  )
}

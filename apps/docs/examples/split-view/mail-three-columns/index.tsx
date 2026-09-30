import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SplitViewMailDemo } from '@/components/blocks/split-view-demos/demos'

// The same composition at three device widths; SplitView measures its own box.
const sizes = [
  { id: 'regular', width: 1120 },
  { id: 'medium', width: 820 },
  { id: 'compact', width: 390 },
]

/**
 * Lays a composition out at a real device width, scaled down (never up) to fit,
 * centered.
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
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div
      ref={host}
      style={{ width: '100%', height: height * scale, position: 'relative' }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          width,
          height,
          marginLeft: -(width * scale) / 2,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          borderRadius: 14 / scale,
          overflow: 'hidden',
          boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.12)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        color: 'var(--muted-foreground)',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  )
}

export default function MailThreeColumns({
  variant = 'regular',
}: {
  variant?: string
}) {
  const size = sizes.find((s) => s.id === variant) ?? sizes[0]
  return (
    <div>
      <Scaled width={size.width} height={size.id === 'compact' ? 700 : 600}>
        <SplitViewMailDemo />
      </Scaled>
      <Caption>
        {size.id === 'regular'
          ? 'Regular: mailboxes, list and message tiled. The sidebar button ' +
            'slides the mailboxes away.'
          : size.id === 'medium'
            ? 'Medium: list and message tile; the sidebar button floats the ' +
              'mailboxes over them.'
            : 'Compact: one column at a time. Pick a row to push; back, Esc ' +
              'or an edge swipe pops.'}
      </Caption>
    </div>
  )
}

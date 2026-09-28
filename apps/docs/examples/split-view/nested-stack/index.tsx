import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SplitViewLibraryDemo } from '@brett_lamy/ui'

/** Lays a composition out at a real device width, scaled down (never up) to fit, centered. */
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
          boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.12)',
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
        color: 'var(--bl-label2)',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  )
}

// The detail column hosts a SplitViewStack: albums push, their tracks push a
// credits page. The sidebar selection is the stack's resetKey.
export default function NestedStack({ variant = 'regular' }: { variant?: string }) {
  const compact = variant === 'compact'
  return (
    <div>
      <Scaled width={compact ? 390 : 1080} height={compact ? 640 : 560}>
        <SplitViewLibraryDemo
          defaultCompactColumn={compact ? 'detail' : undefined}
          initialAlbum={compact ? 'tidewater' : undefined}
        />
      </Scaled>
      <Caption>
        {compact
          ? 'Swipe from the leading edge (or press Esc): the album pops first, then the column.'
          : 'Open an album, then a track. The back button carries the page below’s title, truncated to fit.'}
      </Caption>
    </div>
  )
}

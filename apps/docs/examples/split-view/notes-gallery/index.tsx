import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SplitViewGalleryDemo } from '@brett_lamy/ui'

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

// The grid button calls setSupplementaryVisible(false): the list column slides
// away under the sidebar and the detail springs across to fill its space.
export default function NotesGallery({
  variant = 'gallery',
}: {
  variant?: string
}) {
  return (
    <div>
      <Scaled width={1100} height={560}>
        <SplitViewGalleryDemo
          defaultSupplementaryVisible={variant !== 'gallery'}
        />
      </Scaled>
      <Caption>
        {variant === 'gallery'
          ? 'Gallery: the list column is hidden. Open a card (or the list ' +
            'button) and it springs back.'
          : 'List: the grid button in the list’s bar hides the column and ' +
            'the note grid takes its place.'}
      </Caption>
    </div>
  )
}

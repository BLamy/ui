import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SplitViewSettingsDemo } from '@brett_lamy/ui'

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

export default function SettingsSidebarBehaviours({
  variant = 'tile',
}: {
  variant?: string
}) {
  const tile = variant === 'tile' || !variant
  // Overlay and displace are controlled: tap the scrim, press Esc, or pick a
  // row to dismiss.
  const [open, setOpen] = useState(true)
  useEffect(() => {
    setOpen(true)
  }, [variant])
  return (
    <div>
      <Scaled width={tile ? 1060 : 820} height={560}>
        {tile ? (
          // Regular width: the sidebar tiles; the toggle slides it away and the
          // detail widens.
          <SplitViewSettingsDemo />
        ) : (
          <SplitViewSettingsDemo
            sidebarBehavior={variant as 'overlay' | 'displace'}
            sidebarVisible={open}
            onSidebarVisibleChange={setOpen}
          />
        )}
      </Scaled>
      <Caption>
        {tile
          ? 'Tile (regular): the sidebar takes its own column.'
          : variant === 'overlay'
            ? 'Overlay (medium): the sidebar floats above a scrim. Tap ' +
              'outside or press Esc.'
            : 'Displace (medium): the sidebar pushes the detail aside and ' +
              'dims it.'}
      </Caption>
    </div>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DeliveryTrackingDemo } from '@/components/blocks/delivery-tracking/delivery-tracking-demo'

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

// A TileMap under a docked FloatingSheet with the order's progress.
export default function DeliveryTracking() {
  return (
    <Scaled width={430} height={780}>
      <DeliveryTrackingDemo
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      />
    </Scaled>
  )
}

import { useState } from 'react'
import { RequestTable } from '@/components/ui/request-table'
import { Slider, SliderThumb, SliderTrack } from '@/components/ui/slider'
import type { RequestRow } from '@/lib/request-table'

const PATHS = ['api/cart', 'api/products', 'assets/chunk-a81.js', 'img/product.webp', 'api/checkout']

const ROWS: RequestRow[] = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  url: `https://shop.example.com/${PATHS[i % PATHS.length]}?n=${i}`,
  method: i % 5 === 4 ? 'POST' : 'GET',
  status: i % 17 === 9 ? 500 : 200,
  type: i % 5 === 2 ? 'script' : i % 5 === 3 ? 'img' : 'fetch',
  size: 800 + i * 410,
  time: i * 120,
  duration: 30 + ((i * 71) % 500),
}))

// Under 480 px of its own width the table becomes two-line rows, wherever it is on the page and whatever the size of the
// window. Sorting moves into a menu, and the scroll position and selection stay as they are.
export default function Narrow() {
  const [width, setWidth] = useState(390)
  return (
    <div className="flex w-full flex-col gap-2">
      <Slider<number> aria-label="Table width" size="sm" className="w-full max-w-sm" minValue={300} maxValue={800} value={width} onChange={setWidth}>
        <SliderTrack><SliderThumb /></SliderTrack>
      </Slider>
      <RequestTable aria-label="Requests" rows={ROWS} playhead={3600} defaultSelectedId={12} className="h-[360px] max-w-full" style={{ width }} />
    </div>
  )
}

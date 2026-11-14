import { Segmented, SegmentedItem } from '@/components/ui/segmented'
import { Button } from '@/components/ui/button'

const sizes = ['sm', 'default', 'lg'] as const

// `size` gives the control Button's heights (32 / 36 / 44px), so it lines up
// with the buttons beside it in a toolbar.
export default function Sizes() {
  return (
    <div className="mx-auto grid max-w-md gap-3">
      {sizes.map((size) => (
        <div key={size} className="flex items-center gap-2">
          <Segmented aria-label={`Alignment, ${size}`} size={size} defaultValue="center" className="flex-1">
            <SegmentedItem value="left">Left</SegmentedItem>
            <SegmentedItem value="center">Center</SegmentedItem>
            <SegmentedItem value="right">Right</SegmentedItem>
          </Segmented>
          <Button size={size} variant="secondary">Apply</Button>
        </div>
      ))}
    </div>
  )
}

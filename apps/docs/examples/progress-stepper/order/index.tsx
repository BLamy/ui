import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProgressStepper, type ProgressStepItem } from '@/components/ui/progress-stepper'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Icon } from '@/lib/icon'

const steps: ProgressStepItem[] = [
  { id: 'placed', label: 'Placed', icon: <Icon name="check-circle" size={22} /> },
  { id: 'packed', label: 'Packed', icon: <Icon name="archivebox" size={22} /> },
  { id: 'shipped', label: 'Shipped', icon: <Icon name="airplane" size={22} /> },
  { id: 'delivered', label: 'Delivered', icon: <Icon name="house" size={22} /> },
]

// `current` is the step in progress: earlier steps are complete, later ones upcoming.
// Step past the end (4) and every milestone reads as complete.
export default function Order() {
  const [current, setCurrent] = useState(2)
  const [variant, setVariant] = useState<'bars' | 'line'>('bars')
  const [labels, setLabels] = useState(true)
  const [animated, setAnimated] = useState(true)
  return (
    <div className="mx-auto grid w-full max-w-md gap-5">
      <ProgressStepper
        steps={steps}
        current={current}
        variant={variant}
        labels={labels}
        animated={animated}
      />
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
        >
          Back
        </Button>
        <span className="text-footnote text-muted-foreground tabular-nums">
          {current < steps.length ? steps[current].label : 'All done'}
        </span>
        <Button
          size="sm"
          disabled={current === steps.length}
          onClick={() => setCurrent((c) => c + 1)}
        >
          Next
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-footnote">
        <Segmented aria-label="Variant" value={variant} onValueChange={(v) => v && setVariant(v as 'bars' | 'line')}>
          <SegmentedItem value="bars">bars</SegmentedItem>
          <SegmentedItem value="line">line</SegmentedItem>
        </Segmented>
        <label className="flex items-center gap-2">
          <Switch checked={labels} onCheckedChange={setLabels} aria-label="Labels" />
          labels
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={animated} onCheckedChange={setAnimated} aria-label="Animated" />
          animated
        </label>
      </div>
    </div>
  )
}

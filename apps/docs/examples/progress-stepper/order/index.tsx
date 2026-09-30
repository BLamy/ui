import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProgressStepper, type ProgressStep } from '@/components/ui/progress-stepper'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Icon } from '@/lib/icon'

const steps: ProgressStep[] = [
  { id: 'placed', label: 'Placed', icon: <Icon name="check-circle" size={22} /> },
  { id: 'packed', label: 'Packed', icon: <Icon name="archivebox" size={22} /> },
  { id: 'shipped', label: 'Shipped', icon: <Icon name="airplane" size={22} /> },
  { id: 'delivered', label: 'Delivered', icon: <Icon name="house" size={22} /> },
]

// `current` is the step in progress: earlier steps are done, later ones to do.
// Step past the end (4) and every milestone reads as done.
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
          isDisabled={current === 0}
          onPress={() => setCurrent((c) => c - 1)}
        >
          Back
        </Button>
        <span className="text-footnote text-muted-foreground tabular-nums">
          {current < steps.length ? steps[current].label : 'All done'}
        </span>
        <Button
          size="sm"
          isDisabled={current === steps.length}
          onPress={() => setCurrent((c) => c + 1)}
        >
          Next
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-footnote">
        <Segmented
          aria-label="Variant"
          value={variant}
          onChange={(v) => setVariant(v as 'bars' | 'line')}
          options={[
            { id: 'bars', label: 'bars' },
            { id: 'line', label: 'line' },
          ]}
        />
        <label className="flex items-center gap-2">
          <Switch checked={labels} onChange={setLabels} aria-label="Labels" />
          labels
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={animated} onChange={setAnimated} aria-label="Animated" />
          animated
        </label>
      </div>
    </div>
  )
}

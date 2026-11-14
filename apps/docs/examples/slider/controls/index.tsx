import { useState } from 'react'
import { Slider } from '@/components/ui/slider'

// `label` + `showValue` add a caption and the formatted value; `format` takes
// Intl.NumberFormat options. Pass an array for a range with two thumbs.
export default function Controls() {
  const [range, setRange] = useState<number[]>([20, 80])
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <Slider label="Brightness" showValue defaultValue={0.64} min={0} max={1} step={0.01} format={{ style: 'percent' }} />
      <Slider label="Text size" showValue defaultValue={3} min={1} max={7} step={1} />
      <Slider
        label="Budget"
        showValue
        min={0}
        max={500}
        step={10}
        value={range}
        onValueChange={setRange}
        thumbLabels={['Lowest budget', 'Highest budget']}
        format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
      />
      <Slider label="Locked" showValue defaultValue={30} disabled />
    </div>
  )
}

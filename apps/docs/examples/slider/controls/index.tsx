import { useState } from 'react'
import { Slider } from '@/components/ui/slider'

// `label` + `showValue` add a caption and the formatted value; formatOptions is
// Intl.NumberFormat. Pass an array for a range with two thumbs.
export default function Controls() {
  const [range, setRange] = useState<number[]>([20, 80])
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <Slider label="Brightness" showValue defaultValue={0.64} minValue={0} maxValue={1} step={0.01} formatOptions={{ style: 'percent' }} />
      <Slider label="Text size" showValue defaultValue={3} minValue={1} maxValue={7} step={1} />
      <Slider
        label="Budget"
        showValue
        minValue={0}
        maxValue={500}
        step={10}
        value={range}
        onChange={(v) => setRange(v as number[])}
        formatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
      />
      <Slider label="Locked" showValue defaultValue={30} isDisabled />
    </div>
  )
}

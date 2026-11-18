import { useState } from 'react'
import { formatColor, parseColor } from '@brett_lamy/ui/sdk/core/color'
import {
  ColorPicker,
  ColorPickerSlider,
  ColorPickerSwatches,
  ColorPickerSwatch,
  ColorPickerSwatchItem,
} from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'

const presets = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2']

// A preset row plus an opacity slider. Choosing a preset sets the whole color,
// its opacity included; the slider then edits the opacity alone. The value is
// written as hex, with two more digits once the opacity is below 1. It starts
// as a fixed hsl() color so the demo reads the same for everyone.
export default function PresetsOpacity() {
  const [color, setColor] = useState('hsl(262 83% 66% / 0.6)')
  const parsed = parseColor(color)
  return (
    <ColorPicker
      aria-label="Label color"
      value={color}
      onValueChange={setColor}
      className="mx-auto grid max-w-xs gap-4"
    >
      <div>
        <Label variant="field" htmlFor="label-color-presets">Presets</Label>
        <ColorPickerSwatches id="label-color-presets" className="mt-2">
          {presets.map((c) => (
            <ColorPickerSwatchItem key={c} value={c} />
          ))}
        </ColorPickerSwatches>
      </div>
      <ColorPickerSlider channel="alpha" label="Opacity" showValue />
      <div className="flex items-center gap-3">
        <ColorPickerSwatch className="size-10 rounded-ctl" />
        <code className="text-footnote text-foreground/70">
          {parsed ? formatColor(parsed, 'hex') : color}
        </code>
      </div>
    </ColorPicker>
  )
}

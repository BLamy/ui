import { useState } from 'react'
import { parseColor, type Color } from 'react-aria-components'
import { ColorSwatch } from '@/components/ui/color-field'
import {
  ColorPicker,
  ColorSlider,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
} from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'

const presets = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2']

// A preset row plus an opacity slider. Choosing a preset replaces the hue,
// saturation and brightness; the picker's color keeps going in `hexa` (with the
// opacity) for output. The value starts as a fixed hsla color so the demo
// reads the same for everyone.
export default function PresetsOpacity() {
  const [color, setColor] = useState<Color>(parseColor('hsla(262, 83%, 66%, 0.6)'))
  return (
    <ColorPicker value={color} onChange={setColor}>
      <div className="mx-auto grid max-w-xs gap-4">
        <div>
          <Label variant="field">Presets</Label>
          <ColorSwatchPicker aria-label="Presets" className="mt-2">
            {presets.map((c) => (
              <ColorSwatchPickerItem key={c} color={c} />
            ))}
          </ColorSwatchPicker>
        </div>
        <ColorSlider channel="alpha" label="Opacity" showValue />
        <div className="flex items-center gap-3">
          <ColorSwatch className="size-10 rounded-ctl" />
          <code className="text-footnote text-foreground/70">{color.toString('hexa')}</code>
        </div>
      </div>
    </ColorPicker>
  )
}

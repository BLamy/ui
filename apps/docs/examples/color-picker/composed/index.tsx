import { useState } from 'react'
import { parseColor, type Color } from 'react-aria-components'
import { ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch } from '@/components/ui/color-field'
import { ColorArea, ColorPicker, ColorSlider } from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'

// Every part reads the color from the surrounding ColorPicker, so you can lay
// them out however you like, here in a panel with no popover. The area edits
// saturation and brightness together, the slider the hue; the hex field edits
// all of it.
export default function Composed() {
  const [color, setColor] = useState<Color>(parseColor('#0a84ff'))
  return (
    <ColorPicker value={color} onChange={setColor}>
      <div className="mx-auto grid max-w-xs gap-4 rounded-panel bg-secondary p-4">
        <ColorArea className="h-40 w-full" />
        <ColorSlider colorSpace="hsb" channel="hue" label="Hue" showValue />
        <ColorField>
          <Label variant="field">Hex</Label>
          <ColorFieldGroup size="sm">
            <ColorFieldSwatch className="size-5" />
            <ColorFieldInput />
          </ColorFieldGroup>
        </ColorField>
      </div>
    </ColorPicker>
  )
}

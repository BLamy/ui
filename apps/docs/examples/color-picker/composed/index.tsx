import { useState } from 'react'
import { ColorFieldGroup, ColorFieldInput, ColorFieldSwatch } from '@/components/ui/color-field'
import { ColorPicker, ColorPickerArea, ColorPickerSlider } from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'

// Every part edits the color of the ColorPicker around it, so you can lay them
// out however you like, here in a panel with no popover. The picker is the
// panel itself: a group, named for screen readers. The area edits saturation
// and brightness together, the slider the hue; the text field edits all of it.
export default function Composed() {
  const [color, setColor] = useState('#0a84ff')
  return (
    <ColorPicker
      aria-label="Accent"
      value={color}
      onValueChange={setColor}
      className="mx-auto grid max-w-xs gap-4 rounded-panel bg-secondary p-4"
    >
      <ColorPickerArea className="h-40 w-full" />
      <ColorPickerSlider channel="hue" label="Hue" showValue />
      <div className="flex flex-col gap-1.5">
        <Label variant="field" htmlFor="composed-hex">Hex</Label>
        <ColorFieldGroup size="sm">
          <ColorFieldSwatch className="size-5" />
          <ColorFieldInput id="composed-hex" />
        </ColorFieldGroup>
      </div>
    </ColorPicker>
  )
}

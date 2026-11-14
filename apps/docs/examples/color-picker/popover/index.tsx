import { useState } from 'react'
import { ColorPicker, ColorPickerContent, ColorPickerTrigger } from '@/components/ui/color-picker'
import { Field, FieldLabel } from '@/components/ui/field'
import { ThemeScope } from '@/lib/theme'

const swatches = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2']

// The trigger shows the current color and its hex; the popover holds an area,
// a hue slider, a text field and the preset swatches. ColorPicker holds the
// color and the popover's open state, so the trigger and the content go straight
// in it, they and your own code read the same value, and the Field's label names
// the picker.
export default function PopoverExample() {
  const [color, setColor] = useState('#7f5af0')
  // The ThemeScope is only here so the popover wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-3">
      <Field>
        <FieldLabel>Accent</FieldLabel>
        <ColorPicker value={color} onValueChange={setColor}>
          <ColorPickerTrigger />
          <ColorPickerContent swatches={swatches} />
        </ColorPicker>
      </Field>
      <p className="m-0 px-1 text-footnote text-foreground/70">
        Selected: <code>{color}</code>
      </p>
    </ThemeScope>
  )
}

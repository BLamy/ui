import { useState } from 'react'
import { ColorPicker, ColorPickerContent, ColorPickerTrigger } from '@/components/ui/color-picker'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover } from '@/components/ui/popover'
import { ThemeScope } from '@/lib/theme'

const swatches = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2']

// The trigger shows the current color and its hex; the popover holds an area,
// a hue slider, a text field and the preset swatches. ColorPicker holds the
// color, so the trigger, the parts and your own code all read the same value,
// and the Field's label names the picker.
export default function PopoverExample() {
  const [color, setColor] = useState('#7f5af0')
  // The ThemeScope is only here so the popover wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-3">
      <Field>
        <FieldLabel variant="field">Accent</FieldLabel>
        <ColorPicker value={color} onValueChange={setColor}>
          <Popover>
            <ColorPickerTrigger />
            <ColorPickerContent swatches={swatches} />
          </Popover>
        </ColorPicker>
      </Field>
      <p className="m-0 px-1 text-footnote text-foreground/70">
        Selected: <code>{color}</code>
      </p>
    </ThemeScope>
  )
}

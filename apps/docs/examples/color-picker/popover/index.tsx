import { useState } from 'react'
import { parseColor, type Color } from 'react-aria-components'
import { ColorPicker, ColorPickerContent, ColorPickerTrigger } from '@/components/ui/color-picker'
import { PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { ThemeScope } from '@/lib/theme'

const swatches = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2']

// The trigger shows the current color and its hex; the popover holds an area,
// a hue slider, a hex field and the preset swatches. ColorPicker holds the
// color, so the trigger, the parts and your own code all read the same value.
export default function Popover() {
  const [color, setColor] = useState<Color>(parseColor('#7f5af0'))
  // The ThemeScope is only here so the portalled popover wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-3">
      <ColorPicker value={color} onChange={setColor}>
        <Label variant="field">Accent</Label>
        <PopoverTrigger>
          <ColorPickerTrigger aria-label="Accent color" />
          <ColorPickerContent swatches={swatches} />
        </PopoverTrigger>
      </ColorPicker>
      <p className="m-0 px-1 text-footnote text-foreground/70">
        Selected: <code>{color.toString('hex')}</code>
      </p>
    </ThemeScope>
  )
}

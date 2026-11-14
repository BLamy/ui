import { useState } from 'react'
import { formatColor, parseColor } from '@ui-sdk/core/color'
import { ColorInput } from '@/components/ui/color-picker'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

// Typing never changes the color until the text is one: the field reads it on
// Enter or when it loses focus (try "rebeccapurple" or "oklch(0.7 0.15 250)"),
// and puts the value back if the text is not a color. `onValueChange` gets a
// CSS color string; parseColor turns it into data when you need the channels.
export default function Basic() {
  const [color, setColor] = useState('#7f5af0')
  const parsed = parseColor(color)
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <Field>
        <FieldLabel>Accent</FieldLabel>
        <ColorInput value={color} onValueChange={setColor} />
        <FieldDescription>
          Any CSS color. Held as {parsed ? formatColor(parsed, 'hsl', { precision: 3 }) : color}.
        </FieldDescription>
      </Field>

      <Field invalid>
        <FieldLabel>Brand</FieldLabel>
        <ColorInput size="sm" defaultValue="#ff453a" />
        <FieldError match>Pick a darker color.</FieldError>
      </Field>
    </div>
  )
}

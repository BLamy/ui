import { useState } from 'react'
import { parseColor, type Color } from 'react-aria-components'
import { ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch } from '@/components/ui/color-field'
import { Label } from '@/components/ui/label'
import { FieldDescription, FieldError } from '@/components/ui/text-field'

// Typing never changes the color until it is valid: the field commits when it
// loses focus (try "0a84ff" or "#0a84ff"), and reverts to the last color if the
// text does not parse. `onChange` gets a Color, or null when the field is empty.
export default function Basic() {
  const [color, setColor] = useState<Color | null>(parseColor('#7f5af0'))
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <ColorField value={color} onChange={setColor}>
        <Label variant="field">Accent</Label>
        <ColorFieldGroup>
          <ColorFieldSwatch />
          <ColorFieldInput />
        </ColorFieldGroup>
        <FieldDescription>
          A hex color, with or without the #. Held as {color ? color.toString('hsl') : 'nothing'}.
        </FieldDescription>
      </ColorField>

      <ColorField defaultValue="#ff453a" isInvalid>
        <Label variant="field">Brand</Label>
        <ColorFieldGroup size="sm">
          <ColorFieldSwatch />
          <ColorFieldInput />
        </ColorFieldGroup>
        <FieldError>Pick a darker color.</FieldError>
      </ColorField>
    </div>
  )
}

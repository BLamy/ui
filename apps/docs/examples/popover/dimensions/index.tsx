import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { ThemeScope } from '@/lib/theme'

// A popover is a dialog anchored to its trigger: focus moves in, Esc or an
// outside press closes it and focus goes back to the button. PopoverTitle
// names it, and a PopoverClose rendered as a Button is its Done.
export default function Dimensions() {
  const [size, setSize] = useState({ width: '320', height: 'auto', opacity: 80 })
  return (
    <ThemeScope className="mx-auto grid max-w-sm justify-items-start gap-4">
      <Popover>
        <PopoverTrigger render={<Button variant="secondary" />}>Dimensions</PopoverTrigger>
        <PopoverContent align="start">
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription className="mt-1 mb-3">Set the size of the layer.</PopoverDescription>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel>Width</FieldLabel>
              <Input
                size="sm"
                inputMode="numeric"
                value={size.width}
                onValueChange={(width) => setSize((s) => ({ ...s, width }))}
              />
            </Field>
            <Field>
              <FieldLabel>Height</FieldLabel>
              <Input
                size="sm"
                value={size.height}
                onValueChange={(height) => setSize((s) => ({ ...s, height }))}
              />
            </Field>
            <Slider
              label="Opacity"
              showValue
              value={size.opacity}
              onValueChange={(opacity) => setSize((s) => ({ ...s, opacity }))}
            />
            <PopoverClose render={<Button size="sm" />}>Done</PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
      <p className="m-0 text-footnote text-muted-foreground">
        Layer: {size.width} × {size.height}, {size.opacity}% opacity
      </p>
    </ThemeScope>
  )
}

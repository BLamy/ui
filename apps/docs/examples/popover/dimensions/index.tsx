import { useState } from 'react'
import { Heading } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { TextField } from '@/components/ui/text-field'
import { ThemeScope } from '@/lib/theme'

// A popover is a dialog anchored to its trigger: focus moves in, Tab stays
// inside, Esc or an outside press closes it and focus goes back to the button.
// Children may be a function to receive `close`.
export default function Dimensions() {
  const [size, setSize] = useState({ width: '320', height: 'auto', opacity: 80 })
  // The ThemeScope is only here so the portalled overlay wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm justify-items-start gap-4">
      <PopoverTrigger>
        <Button variant="secondary">Dimensions</Button>
        <PopoverContent placement="bottom start">
          {({ close }) => (
            <>
              <Heading slot="title" className="m-0 text-body font-semibold text-foreground">
                Dimensions
              </Heading>
              <p className="mt-1 mb-3 text-footnote text-muted-foreground">
                Set the size of the layer.
              </p>
              <div className="flex flex-col gap-3">
                <TextField
                  value={size.width}
                  onChange={(width) => setSize((s) => ({ ...s, width }))}
                >
                  <Label variant="field">Width</Label>
                  <Input size="sm" inputMode="numeric" />
                </TextField>
                <TextField
                  value={size.height}
                  onChange={(height) => setSize((s) => ({ ...s, height }))}
                >
                  <Label variant="field">Height</Label>
                  <Input size="sm" />
                </TextField>
                <Slider
                  label="Opacity"
                  showValue
                  value={size.opacity}
                  onChange={(opacity) => setSize((s) => ({ ...s, opacity }))}
                />
                <Button size="sm" onPress={close}>Done</Button>
              </div>
            </>
          )}
        </PopoverContent>
      </PopoverTrigger>
      <p className="m-0 text-footnote text-muted-foreground">
        Layer: {size.width} × {size.height}, {size.opacity}% opacity
      </p>
    </ThemeScope>
  )
}

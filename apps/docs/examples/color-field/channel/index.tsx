import { useState } from 'react'
import { parseColor, type Color } from 'react-aria-components'
import { ColorField, ColorSwatch } from '@/components/ui/color-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// `channel` turns the field into a number box for one channel of a color in the
// `colorSpace` you name. Three of them share one Color, so editing any updates
// the swatch and the other two.
export default function Channel() {
  const [color, setColor] = useState<Color | null>(parseColor('hsl(262, 83%, 66%)'))
  const channels = [
    { channel: 'hue', label: 'Hue' },
    { channel: 'saturation', label: 'Saturation' },
    { channel: 'lightness', label: 'Lightness' },
  ] as const
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="flex items-center gap-3">
        {color ? <ColorSwatch color={color} className="size-10" /> : null}
        <code className="text-footnote text-foreground/70">
          {color ? color.toString('hex') : 'no color'}
        </code>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {channels.map(({ channel, label }) => (
          <ColorField key={channel} colorSpace="hsl" channel={channel} value={color} onChange={setColor}>
            <Label variant="field">{label}</Label>
            <Input />
          </ColorField>
        ))}
      </div>
    </div>
  )
}

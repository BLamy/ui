import { useState } from 'react'
import { formatColor, parseColor } from '@brett_lamy/ui/sdk/core/color'
import { ColorPicker, ColorPickerChannelInput, ColorPickerInputGroup, ColorPickerSwatch } from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'

const channels = [
  { channel: 'hue', label: 'Hue' },
  { channel: 'saturation', label: 'Saturation' },
  { channel: 'lightness', label: 'Lightness' },
] as const

// A ColorPickerChannelInput is a number box for one channel of the color in the
// root's `space`, with its unit after it. Here one ColorPicker holds the color and
// three boxes edit it, each in a ColorPickerInputGroup, so changing any updates the
// swatch and the value.
export default function Channel() {
  const [color, setColor] = useState('hsl(262 83% 66%)')
  const parsed = parseColor(color)
  return (
    <ColorPicker
      aria-label="Accent"
      space="hsl"
      value={color}
      onValueChange={setColor}
      className="mx-auto grid max-w-sm gap-4"
    >
      <div className="flex items-center gap-3">
        <ColorPickerSwatch className="size-10" />
        <code className="text-footnote text-foreground/70">
          {color}{parsed ? ` · ${formatColor(parsed, 'hex')}` : null}
        </code>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {channels.map(({ channel, label }) => (
          <div key={channel} className="flex flex-col gap-1.5">
            <Label variant="field" htmlFor={`channel-${channel}`}>{label}</Label>
            <ColorPickerInputGroup>
              <ColorPickerChannelInput id={`channel-${channel}`} channel={channel} />
            </ColorPickerInputGroup>
          </div>
        ))}
      </div>
    </ColorPicker>
  )
}

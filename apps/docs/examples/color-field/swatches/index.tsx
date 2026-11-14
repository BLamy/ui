import { ColorSwatch } from '@/components/ui/color-field'

const colors = [
  { color: '#ff453a', name: 'Red' },
  { color: '#ff9f0a', name: 'Orange' },
  { color: '#ffd60a', name: 'Yellow' },
  { color: '#30d158', name: 'Green' },
  { color: '#0a84ff', name: 'Blue' },
  { color: '#bf5af2', name: 'Purple' },
]

// A ColorSwatch paints any CSS color string. It is an image, so give it a name
// people can use with `aria-label`; without one it is named by the CSS value.
// A translucent color shows the surface behind it.
export default function Swatches() {
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="flex items-center gap-2">
        {colors.map(({ color, name }) => (
          <ColorSwatch key={color} color={color} aria-label={name} className="size-8" />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {[1, 0.75, 0.5, 0.25, 0.1].map((a) => (
          <ColorSwatch
            key={a}
            color={`rgb(10 132 255 / ${a})`}
            aria-label={`Blue, ${a * 100}% opaque`}
            className="size-8"
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <ColorSwatch color="#0a84ff" aria-label="Blue" className="size-6" />
        <ColorSwatch color="#0a84ff" aria-label="Blue" className="size-10 rounded-lg" />
        <ColorSwatch color="#0a84ff" aria-label="Blue" className="h-10 w-24 rounded-ctl" />
      </div>
    </div>
  )
}

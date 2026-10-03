import { ColorSwatch } from '@/components/ui/color-field'

const colors = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2']

// A ColorSwatch paints any CSS color string (or a parseColor() object). It is an
// image with a spoken name ("vibrant red", "50% opaque blue"), and a
// checkerboard sits behind it so transparency reads as transparency.
export default function Swatches() {
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="flex items-center gap-2">
        {colors.map((c) => (
          <ColorSwatch key={c} color={c} className="size-8" />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {[1, 0.75, 0.5, 0.25, 0.1].map((a) => (
          <ColorSwatch key={a} color={`rgba(10, 132, 255, ${a})`} className="size-8" />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <ColorSwatch color="#0a84ff" className="size-6" />
        <ColorSwatch color="#0a84ff" className="size-10 rounded-lg" />
        <ColorSwatch color="#0a84ff" className="h-10 w-24 rounded-ctl" />
      </div>
    </div>
  )
}

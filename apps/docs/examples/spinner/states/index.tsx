import { useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

// Spinner draws in `currentColor`, so it takes the colour of the text around
// it. It turns by default; `paused` holds the spokes still.
export default function States() {
  const [paused, setPaused] = useState(false)
  return (
    <div className="grid justify-items-center gap-6">
      <div className="flex items-end gap-8 text-muted-foreground">
        {[16, 22, 32, 44].map((size) => (
          <div key={size} className="grid justify-items-center gap-2">
            <Spinner paused={paused} size={size} />
            <span className="text-caption2 tabular-nums">{size}px</span>
          </div>
        ))}
        <div className="grid justify-items-center gap-2 text-primary">
          <Spinner paused={paused} size={32} />
          <span className="text-caption2">tinted</span>
        </div>
        <div className="grid justify-items-center gap-2 text-destructive">
          <Spinner paused={paused} size={32} />
          <span className="text-caption2">destructive</span>
        </div>
      </div>
      <label className="flex items-center gap-3 text-subhead">
        <Switch checked={paused} onCheckedChange={setPaused} aria-label="Paused" />
        paused
      </label>
    </div>
  )
}

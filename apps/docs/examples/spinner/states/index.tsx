import { useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

// Spinner draws in `currentColor`, so it takes the colour of the text around
// it. `spin` turns the stepped rotation on; without it the spokes stay still.
export default function States() {
  const [spin, setSpin] = useState(true)
  return (
    <div className="grid justify-items-center gap-6">
      <div className="flex items-end gap-8 text-muted-foreground">
        {[16, 22, 32, 44].map((size) => (
          <div key={size} className="grid justify-items-center gap-2">
            <Spinner spin={spin} size={size} />
            <span className="text-caption2 tabular-nums">{size}px</span>
          </div>
        ))}
        <div className="grid justify-items-center gap-2 text-primary">
          <Spinner spin={spin} size={32} />
          <span className="text-caption2">tinted</span>
        </div>
        <div className="grid justify-items-center gap-2 text-destructive">
          <Spinner spin={spin} size={32} />
          <span className="text-caption2">destructive</span>
        </div>
      </div>
      <label className="flex items-center gap-3 text-subhead">
        <Switch checked={spin} onChange={setSpin} aria-label="Spin" />
        spin
      </label>
    </div>
  )
}

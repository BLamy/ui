import { useState } from 'react'
import { CronEditor } from '@/components/ui/cron-editor'

// The expression is the value. Where the browser has WebGPU a "Describe the
// schedule" box proposes one for you to review; elsewhere the box is replaced
// by a note and the rest works the same. "Now" and the zone are pinned so the
// next runs read the same for everyone; in an app, leave `from` out.
export default function Basic() {
  const [cron, setCron] = useState('0 9 * * 1-5')
  return (
    <div className="mx-auto grid max-w-md gap-3">
      <CronEditor
        value={cron}
        onValueChange={setCron}
        from="2026-10-02T10:00:00Z"
        timeZone="UTC"
        locale="en-US"
      />
      <p className="m-0 px-1 text-footnote text-foreground/70">
        Value: <code>{cron || '(empty)'}</code>
      </p>
    </div>
  )
}

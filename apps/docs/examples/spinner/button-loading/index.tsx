import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const save = () => new Promise<void>((resolve) => setTimeout(resolve, 1800))

// A pending action: `onClick` returns the request's Promise, so the Button is
// pending until it settles: it ignores further presses, keeps focus and says
// it is busy. The spinner mounts (and grows in) beside the label meanwhile.
export default function ButtonLoading() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        onClick={async () => {
          setSaved(false)
          setSaving(true)
          await save()
          setSaving(false)
          setSaved(true)
        }}
      >
        {saving ? <Spinner size={16} /> : null}
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
      <p role="status" className="h-4 text-footnote text-muted-foreground">
        {saved ? 'Saved just now' : ''}
      </p>
    </div>
  )
}

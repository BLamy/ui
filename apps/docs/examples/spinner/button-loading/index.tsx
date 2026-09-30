import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

// A pending action: the spinner mounts (and grows in) while the request runs.
// The button stays in the layout and is disabled, so a second press can't
// double-submit.
export default function ButtonLoading() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saving) return
    const t = setTimeout(() => {
      setSaving(false)
      setSaved(true)
    }, 1800)
    return () => clearTimeout(t)
  }, [saving])
  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        isDisabled={saving}
        onPress={() => {
          setSaved(false)
          setSaving(true)
        }}
      >
        {saving ? <Spinner spin size={16} /> : null}
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
      <p
        role="status"
        className="h-4 text-footnote text-muted-foreground"
      >
        {saved ? 'Saved just now' : ''}
      </p>
    </div>
  )
}

import { useState } from 'react'
import { FontStackPicker } from '@/components/ui/font-picker'
import { Label } from '@/components/ui/label'
import { fontStack, useGoogleFont } from '@/lib/google-fonts'
import { ThemeScope } from '@/lib/theme'

// A theme's fonts as stacks: the first family that loads is used, the rest
// are its fallbacks. A family you add goes in front; drag a chip (or press
// its handle and use the arrow keys) to reorder. Hovering the list previews
// the stack with that family in front, so the card below shows what you'd get.
export default function ThemeStacks() {
  const [sans, setSans] = useState<string[]>(['Inter'])
  const [mono, setMono] = useState<string[]>(['JetBrains Mono'])
  const [previewSans, setPreviewSans] = useState<string[] | undefined>()
  const [previewMono, setPreviewMono] = useState<string[] | undefined>()
  const shownSans = previewSans ?? sans
  const shownMono = previewMono ?? mono
  useGoogleFont([...shownSans, ...shownMono])
  return (
    <ThemeScope className="mx-auto grid max-w-md gap-4">
      <div className="grid gap-1.5">
        <Label variant="field" className="text-foreground/70">Text</Label>
        <FontStackPicker aria-label="Text fonts" value={sans} onChange={setSans} onPreview={setPreviewSans} placeholder="System font" />
      </div>
      <div className="grid gap-1.5">
        <Label variant="field" className="text-foreground/70">Code</Label>
        <FontStackPicker aria-label="Code fonts" value={mono} onChange={setMono} onPreview={setPreviewMono} defaultCategory="monospace" placeholder="System monospace" />
      </div>
      <div className="grid gap-2 rounded-card bg-card p-5 shadow-hairline" style={{ fontFamily: fontStack(shownSans) }}>
        <p className="m-0 text-title font-semibold">Ship it on Friday</p>
        <p className="m-0 text-body text-foreground/70">Deploys run from main; preview builds land in about a minute.</p>
        <code className="rounded-lg bg-secondary px-2 py-1.5 text-footnote" style={{ fontFamily: fontStack(shownMono, 'monospace') }}>
          git push origin main
        </code>
      </div>
    </ThemeScope>
  )
}

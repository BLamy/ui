import { useState } from 'react'
import { FontPicker } from '@/components/ui/font-picker'
import { Label } from '@/components/ui/label'
import { fontStack, useGoogleFont } from '@/lib/google-fonts'
import { ThemeScope } from '@/lib/theme'

// Hover a family in the list (or arrow through it) and the headline wears it,
// the way Photoshop's font menu previews on the selected text; choose one to
// keep it. The preview is `undefined` when nothing is being previewed, and
// null for the system font, so `preview === undefined ? font : preview` is
// what to draw.
export default function LivePreview() {
  const [font, setFont] = useState<string | null>('Fraunces')
  const [preview, setPreview] = useState<string | null | undefined>()
  const shown = preview === undefined ? font : preview
  // The list only fetches each name's glyphs; the headline needs the family.
  useGoogleFont(shown)
  // The ThemeScope is only here so the portalled popover wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-md gap-5">
      <div className="grid gap-1.5">
        <Label variant="field" className="text-foreground/70">Headline</Label>
        <FontPicker value={font} onChange={setFont} onPreview={setPreview} aria-label="Headline font" />
      </div>
      <div className="grid gap-2">
        <h2 className="m-0 text-[32px] leading-[1.1] font-bold tracking-tight text-balance" style={{ fontFamily: fontStack(shown) }}>
          Grow something green this weekend
        </h2>
        <p className="m-0 text-body text-foreground/70">
          {preview === undefined ? `${font ?? 'The system font'} · chosen` : `${preview ?? 'The system font'} · previewing`}
        </p>
      </div>
    </ThemeScope>
  )
}

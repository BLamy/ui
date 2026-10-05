import { useState } from 'react'
import { FontList } from '@/components/ui/font-picker'
import { fontStack, useGoogleFont } from '@/lib/google-fonts'

// FontList is the picker's list on its own, for an inspector or a sheet: the
// search and the category filter keep their place while the families scroll,
// and each row only fetches the glyphs of its own name as it comes on screen.
export default function Panel() {
  const [font, setFont] = useState<string | null>('Space Grotesk')
  const [preview, setPreview] = useState<string | null | undefined>()
  const shown = preview === undefined ? font : preview
  useGoogleFont(shown)
  return (
    <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-[1fr_300px]">
      <div className="grid content-center gap-3 rounded-card bg-card p-6 shadow-hairline">
        <p className="m-0 text-footnote font-semibold tracking-wide text-foreground/70 uppercase">Typeface</p>
        <p className="m-0 text-[40px] leading-[1.05] font-semibold" style={{ fontFamily: fontStack(shown) }}>
          Aa Bb Cc
          <br />
          0123456789
        </p>
        <p className="m-0 text-body" style={{ fontFamily: fontStack(shown) }}>
          Sphinx of black quartz, judge my vow.
        </p>
      </div>
      <FontList value={font} onChange={setFont} onPreview={setPreview} className="overflow-hidden rounded-card bg-card shadow-hairline" />
    </div>
  )
}

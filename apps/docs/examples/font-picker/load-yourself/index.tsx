import { fontStack, useGoogleFontStatus } from '@/lib/google-fonts'

const PAIRS = [
  { family: 'Playfair Display', sample: 'Editorial headlines' },
  { family: 'JetBrains Mono', sample: 'const answer = 42' },
  { family: 'Caveat', sample: 'A note in the margin' },
  { family: 'Bebas Neue', sample: 'GAME NIGHT' },
]

// No picker: useGoogleFont (or its status twin, useGoogleFontStatus) loads a
// family from the Google Fonts CDN once, and fontStack gives the font-family
// to set, with a fallback of the same kind behind it.
export default function LoadYourself() {
  return (
    <div className="mx-auto grid max-w-md gap-3">
      {PAIRS.map((p) => <Sample key={p.family} {...p} />)}
    </div>
  )
}

function Sample({ family, sample }: { family: string; sample: string }) {
  const status = useGoogleFontStatus(family)
  return (
    <div className="flex items-baseline justify-between gap-4 rounded-card bg-card px-4 py-3 shadow-hairline">
      <span className="min-w-0 truncate text-[26px] leading-tight" style={{ fontFamily: fontStack(family) }}>{sample}</span>
      <span className="shrink-0 text-caption text-foreground/70">{status === 'ready' ? family : status === 'missing' ? 'Offline' : 'Loading…'}</span>
    </div>
  )
}

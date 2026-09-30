import { useState } from 'react'
import { cn } from '@/lib/utils'

// Each row is cn() of two conflicting utilities next to a pair that does not
// conflict. The swatch is painted with cn's result, so you can see which class
// won. Without the token registration tailwind-merge would read
// `text-footnote` as a colour and drop one of the two in the last row.
const ROWS: { label: string; classes: string; swatch: string }[] = [
  { label: 'Two colors collapse', classes: 'text-foreground text-tertiary-foreground', swatch: 'rounded-ctl bg-card px-3 py-2 text-subhead' },
  { label: 'Two sizes collapse', classes: 'text-footnote text-title', swatch: 'rounded-ctl bg-card px-3 py-2' },
  { label: 'Radius tokens', classes: 'rounded-ctl rounded-sheet', swatch: 'bg-secondary-strong px-3 py-2 text-subhead' },
  { label: 'Spacing tokens', classes: 'h-row h-toolbar', swatch: 'flex items-center rounded-ctl bg-card px-3 text-subhead' },
  { label: 'A size and a color both stay', classes: 'text-footnote text-muted-foreground', swatch: 'rounded-ctl bg-card px-3 py-2' },
]

export default function CnMerge() {
  const [input, setInput] = useState('px-4 py-2 pl-7 bg-card bg-primary text-body text-primary-foreground')
  return (
    <div className="mx-auto grid max-w-[620px] gap-5">
      <div className="grid gap-2">
        {ROWS.map((r) => {
          const out = cn(r.classes)
          return (
            <div key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-card border border-border p-3">
              <div className="min-w-0">
                <div className="text-caption font-semibold text-muted-foreground">{r.label}</div>
                <code className="block truncate font-mono text-caption">cn(&quot;{r.classes}&quot;)</code>
                <code className="block truncate font-mono text-caption text-primary">→ {out}</code>
              </div>
              <div className="flex h-[52px] w-[120px] items-center justify-center">
                <div className={cn(r.swatch, out)}>Sample</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-2 rounded-card border border-border p-3">
        <label htmlFor="cn-input" className="text-caption font-semibold text-muted-foreground">
          Try your own classes
        </label>
        <input
          id="cn-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="h-9 rounded-ctl border border-border bg-background px-3 font-mono text-footnote outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <code className="block min-h-5 font-mono text-footnote break-words text-primary">→ {cn(input)}</code>
      </div>
    </div>
  )
}

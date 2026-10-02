import { useState } from 'react'
import { I18nProvider, useCollator, useDateFormatter, useFilter, useLocale, useNumberFormatter } from 'react-aria'
import { Button } from '@/components/ui/button'

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'ar-EG'] as const
const NAMES = ['Zoë', 'Émile', 'Zoe', 'Élodie', 'Ångström', 'Adam', 'Ana']
const WHEN = new Date(Date.UTC(2026, 2, 9, 12))

// Everything below reads the locale from context: nothing is passed down.
function Readout() {
  const { locale, direction } = useLocale()
  const price = useNumberFormatter({ style: 'currency', currency: 'EUR' })
  const date = useDateFormatter({ dateStyle: 'long', timeZone: 'UTC' })
  // base sensitivity: "e" and "é" are the same letter, which is what search and sorting want.
  const collator = useCollator({ sensitivity: 'base' })
  const { contains } = useFilter({ sensitivity: 'base' })
  const [query, setQuery] = useState('e')
  const sorted = [...NAMES].sort(collator.compare).filter((n) => contains(n, query))

  return (
    <dl className="m-0 grid gap-2 text-footnote" dir={direction}>
      <div className="flex justify-between gap-3">
        <dt className="text-foreground">useLocale</dt>
        <dd className="m-0 font-mono text-foreground">
          {locale} · {direction}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-foreground">useNumberFormatter</dt>
        <dd className="m-0 text-foreground">{price.format(1234.5)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-foreground">useDateFormatter</dt>
        <dd className="m-0 text-foreground">{date.format(WHEN)}</dd>
      </div>
      <div className="grid gap-1.5">
        <dt className="text-foreground">
          <label htmlFor="aria-utilities-query">useFilter · contains (names that contain…)</label>
        </dt>
        <dd className="m-0 grid gap-2">
          <input
            id="aria-utilities-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="box-border w-full rounded-ctl border-0 bg-card px-3 py-2 text-body text-foreground shadow-hairline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
          />
          <span className="text-foreground" aria-live="polite">
            {sorted.length ? sorted.join(', ') : 'No matches'}
          </span>
        </dd>
      </div>
    </dl>
  )
}

export default function Locale() {
  const [locale, setLocale] = useState<string>('en-US')
  return (
    <I18nProvider locale={locale}>
      <div className="mx-auto grid w-full max-w-md gap-4">
        <div role="group" aria-label="Locale" className="flex flex-wrap gap-2">
          {LOCALES.map((l) => (
            <Button key={l} variant="secondary" size="sm" aria-pressed={l === locale} className={l === locale ? 'bg-foreground text-background' : undefined} onPress={() => setLocale(l)}>
              {l}
            </Button>
          ))}
        </div>
        <Readout />
      </div>
    </I18nProvider>
  )
}

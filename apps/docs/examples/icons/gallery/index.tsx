import { useMemo, useState } from 'react'
import { ICON_CATEGORIES, ICON_KEYWORDS, ICON_NAMES, Icon, type IconCategory, type IconWeight } from '@/lib/icon'

const TABS: { id: 'all' | IconCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'media', label: 'Media' },
  { id: 'security', label: 'Security' },
  { id: 'system', label: 'System' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'communication', label: 'Communication' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'status', label: 'Status' },
]
const WEIGHTS: IconWeight[] = ['light', 'regular', 'semibold', 'bold']

// Search by name or keyword ("mute", "lyrics", "settings"), narrow by category,
// and click to copy the JSX.
export default function IconGallery() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | IconCategory>('all')
  const [weight, setWeight] = useState<IconWeight>('regular')
  const [copied, setCopied] = useState<string | null>(null)

  const hits = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const pool = tab === 'all' ? ICON_NAMES : [...ICON_CATEGORIES[tab]].sort()
    return pool.filter((n) => {
      const hay = `${n} ${ICON_KEYWORDS[n] ?? ''}`
      return terms.every((t) => hay.includes(t))
    })
  }, [query, tab])

  const copy = (name: string) => {
    const jsx =
      weight === 'regular'
        ? `<Icon name="${name}" />`
        : `<Icon name="${name}" weight="${weight}" />`
    void navigator.clipboard?.writeText(jsx).catch(() => {})
    setCopied(jsx)
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        width: '100%',
        maxWidth: 640,
        color: 'var(--foreground)',
      }}
    >
      <style>{`
        .ig-tile {
          all: unset; box-sizing: border-box; display: flex;
          flex-direction: column; align-items: center; gap: 7px;
          padding: 12px 4px 9px; border-radius: 12px; cursor: pointer;
          min-width: 0; transition: background .15s;
        }
        .ig-tile:hover { background: var(--secondary); }
        .ig-tile:focus-visible {
          outline: 2px solid var(--primary); outline-offset: -2px;
        }
        .ig-chip {
          all: unset; cursor: pointer; padding: 5px 11px; border-radius: 999px;
          font-size: 13px; font-weight: 500; color: var(--muted-foreground);
          white-space: nowrap;
        }
        .ig-chip[aria-pressed='true'] {
          background: var(--foreground); color: var(--card);
        }
        .ig-chip:focus-visible { outline: 2px solid var(--primary); }
        .ig-search::placeholder { color: var(--tertiary-foreground); }
      `}</style>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderRadius: 12,
          background: 'var(--secondary)',
          color: 'var(--muted-foreground)',
        }}
      >
        <Icon name="magnifyingglass" size={17} weight="semibold" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${ICON_NAMES.length} icons`}
          aria-label="Search icons"
          className="ig-search"
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: 0,
            background: 'transparent',
            font: 'inherit',
            fontSize: 15,
            color: 'var(--foreground)',
          }}
        />
        {query ? (
          <button
            type="button"
            className="ig-chip"
            style={{ padding: 0 }}
            aria-label="Clear"
            onClick={() => setQuery('')}
          >
            <Icon name="xmark-circle-fill" size={17} />
          </button>
        ) : null}
      </label>

      <div
        style={{
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="ig-chip"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        style={{
          borderRadius: 16,
          background: 'var(--card)',
          boxShadow: '0 0 0 .5px var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 10px 8px 14px',
            borderBottom: '.5px solid var(--border)',
            fontSize: 12.5,
            color: 'var(--muted-foreground)',
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {copied
              ? `Copied ${copied}`
              : `${hits.length} icons · click to copy`}
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            {WEIGHTS.map((w) => (
              <button
                key={w}
                type="button"
                className="ig-chip"
                style={{ fontSize: 12, padding: '3px 8px' }}
                aria-pressed={weight === w}
                onClick={() => setWeight(w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 2,
            padding: 8,
            height: 360,
            overflowY: 'auto',
            alignContent: 'start',
          }}
        >
          {hits.map((name) => (
            <button
              key={name}
              type="button"
              className="ig-tile"
              title={name}
              onClick={() => copy(name)}
            >
              <Icon name={name} size={26} weight={weight} />
              <span
                style={{
                  fontSize: 10.5,
                  lineHeight: 1.25,
                  color: 'var(--muted-foreground)',
                  textAlign: 'center',
                  overflowWrap: 'anywhere',
                }}
              >
                {name}
              </span>
            </button>
          ))}
          {hits.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: 40,
                textAlign: 'center',
                color: 'var(--muted-foreground)',
                fontSize: 14,
              }}
            >
              No icons match “{query}”.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

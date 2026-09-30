import { ScrollArea } from '@/components/ui/scroll-area'

const releases = [
  ['3.2.0', 'ThemeScope variables, token scales'],
  ['3.1.4', 'Fix sticky headers under a hidden nav bar'],
  ['3.1.3', 'Segmented indicator resizes between unequal labels'],
  ['3.1.2', 'Tab panels follow the direction of the selection'],
  ['3.1.1', 'Toast stack keeps its order under reduced motion'],
  ['3.1.0', 'IndexBar wave variant with an outline panel'],
  ['3.0.2', 'Registry items computed from the import graph'],
  ['3.0.1', 'Card footers no longer clip focus rings'],
]

const tags = [
  'Buttons', 'Cards', 'Tabs', 'Sheets', 'Toasts', 'Lists', 'Sliders', 'Menus',
  'Tooltips', 'Disclosure', 'Progress', 'Skeletons',
]

const cols = ['Plan', 'Seats', 'Projects', 'Storage', 'Support', 'SSO', 'Audit log']
const plans = [
  ['Free', '2', '3', '1 GB', 'Community', '–', '–'],
  ['Team', '10', '25', '50 GB', 'Email', '–', '30 days'],
  ['Business', '50', 'Unlimited', '1 TB', 'Priority', 'SAML', '1 year'],
  ['Enterprise', 'Custom', 'Unlimited', 'Custom', 'Dedicated', 'SAML + SCIM', 'Custom'],
  ['Education', '100', 'Unlimited', '200 GB', 'Email', 'OIDC', '90 days'],
  ['Nonprofit', '25', 'Unlimited', '100 GB', 'Email', '–', '90 days'],
]

// The region scrolls natively (momentum, overscroll, trackpad) and only the
// scrollbar is restyled. `orientation` picks which axes may scroll. Every one
// is a tab stop (tabIndex 0), so the keyboard can scroll it — give it a name.
export default function Orientations() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <section className="grid gap-2">
        <h3 className="m-0 text-footnote font-semibold text-muted-foreground">
          vertical (default)
        </h3>
        <ScrollArea
          aria-label="Release notes"
          className="h-44 rounded-card bg-card shadow-hairline"
        >
          {releases.map(([v, note]) => (
            <div key={v} className="flex gap-3 px-4 py-2.5 shadow-hairline-b">
              <span className="w-12 shrink-0 text-subhead font-semibold tabular-nums">{v}</span>
              <span className="text-subhead text-muted-foreground">{note}</span>
            </div>
          ))}
        </ScrollArea>
      </section>

      <section className="grid gap-2">
        <h3 className="m-0 text-footnote font-semibold text-muted-foreground">horizontal</h3>
        <ScrollArea
          orientation="horizontal"
          aria-label="Component tags"
          className="rounded-card bg-card p-3 shadow-hairline"
        >
          <div className="flex w-max gap-2 pb-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-secondary px-3 py-1 text-footnote whitespace-nowrap"
              >
                {t}
              </span>
            ))}
          </div>
        </ScrollArea>
      </section>

      <section className="grid gap-2">
        <h3 className="m-0 text-footnote font-semibold text-muted-foreground">both</h3>
        <ScrollArea
          orientation="both"
          aria-label="Plan comparison"
          className="h-40 rounded-card bg-card shadow-hairline"
        >
          <table className="w-max border-collapse text-footnote">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="sticky top-0 bg-card px-7 py-2 text-left font-semibold shadow-hairline-b"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className="px-7 py-2 whitespace-nowrap text-muted-foreground shadow-hairline-b"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </section>
    </div>
  )
}

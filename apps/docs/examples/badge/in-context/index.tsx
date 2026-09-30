import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const DEPLOYS = [
  { name: 'api-gateway', branch: 'main', status: 'Live', variant: 'success', count: 0 },
  { name: 'web-app', branch: 'feat/checkout', status: 'Building', variant: 'tinted', count: 3 },
  { name: 'billing-worker', branch: 'main', status: 'Failed', variant: 'destructive', count: 1 },
  { name: 'docs', branch: 'chore/deps', status: 'Queued', variant: 'secondary', count: 0 },
] as const

// A badge is a plain span, so it sits beside text in a row. Status picks the
// variant; a count badge trails the row only when there is something to count.
export default function InContext() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-card bg-card shadow-hairline">
      {DEPLOYS.map((d, i) => (
        <div key={d.name}>
          {i > 0 && <Separator inset />}
          <div className="flex h-row items-center gap-3 px-4">
            <div className="grid min-w-0 flex-1">
              <span className="truncate text-body text-foreground">{d.name}</span>
              <span className="truncate text-footnote text-muted-foreground">{d.branch}</span>
            </div>
            {d.count > 0 && (
              <Badge variant="outline" aria-label={`${d.count} warnings`}>
                {d.count}
              </Badge>
            )}
            <Badge variant={d.variant}>{d.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

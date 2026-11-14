import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/lib/icon'

// The three sizes: `sm` sits inside a list or popup, `default` fills a pane,
// `lg` fills a page. Each takes the same four slots.
export default function Sizes() {
  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
      <Card>
        <EmptyState size="sm" icon={<Icon name="magnifyingglass" />} title="No matches" description="Try a different search." />
      </Card>
      <Card className="h-56">
        <EmptyState icon={<Icon name="tray" />} title="No messages" description="Messages you receive will appear here." />
      </Card>
      <Card className="col-span-full">
        <EmptyState
          size="lg"
          icon={<Icon name="star" />}
          title="No favorites yet"
          description="Tap the star on any item to keep it here."
          action={<Button>Browse items</Button>}
        />
      </Card>
    </div>
  )
}

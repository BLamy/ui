import { LogList } from '@/components/ui/log-list'

// Nothing logged yet: the empty state is a status region beside the log's grid.
export default function Empty() {
  return <LogList aria-label="Console" rows={[]} emptyState="No messages yet" className="h-[200px] w-full" />
}

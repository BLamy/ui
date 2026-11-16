import { RequestTable } from '@/components/ui/request-table'

// Before the page has made a request: the columns stay, and "No requests" is announced.
export default function Empty() {
  return <RequestTable aria-label="Network" rows={[]} className="h-[240px] w-full" />
}

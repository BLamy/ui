import { Input } from '@/components/ui/input'

// `size` sets the height and type size: sm 32px, default 44px, lg 50px.
// A bare Input has no visible label, so give each one an aria-label.
export default function Sizes() {
  return (
    <div className="mx-auto grid max-w-sm gap-3">
      <Input size="sm" aria-label="Filter by tag" placeholder="Filter by tag" />
      <Input aria-label="Project name" placeholder="Project name" />
      <Input size="lg" aria-label="Workspace URL" placeholder="acme.example.com" defaultValue="replay.example.com" />
    </div>
  )
}

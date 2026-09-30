import { Textarea } from '@/components/ui/textarea'

// Three minimum heights: sm 64px, default 96px, lg 144px. It never resizes by
// hand (resize-none); it scrolls once the text passes the height.
export default function Sizes() {
  return (
    <div className="mx-auto grid max-w-sm gap-3">
      <Textarea size="sm" aria-label="Note" placeholder="Quick note" />
      <Textarea aria-label="Commit message" placeholder="Describe the change" defaultValue={'Fix scroll restoration when a thread is re-opened\n\nThe saved offset was read before the list measured its rows.'} />
      <Textarea size="lg" aria-label="Notes" placeholder="Release notes" disabled defaultValue="Locked while the release is being published." />
    </div>
  )
}

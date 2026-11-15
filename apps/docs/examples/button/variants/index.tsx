import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icon'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-footnote text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

// Variants set the colour, sizes set the height and radius. `pill` is the
// full-width iOS action; `icon-sm`, `icon` and `icon-lg` are for a lone glyph.
export default function Variants() {
  return (
    <div className="mx-auto grid max-w-xl gap-5 p-2">
      <Row label="variant">
        <Button>Save changes</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="outline">Edit</Button>
        <Button variant="contrast">Continue</Button>
        <Button variant="ghost">Skip</Button>
        <Button variant="quiet">Hide</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="plain">Not now</Button>
        <Button variant="link">Learn more</Button>
      </Row>
      <Row label="size">
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
        <Button variant="quiet" size="icon-sm" aria-label="Edit">
          <Icon name="pencil" size={18} sw={1.7} />
        </Button>
        <Button size="icon" aria-label="Add contact">
          <Icon name="plus" size={18} sw={2} />
        </Button>
        <Button variant="secondary" size="icon-lg" aria-label="More">
          <Icon name="ellipsis" size={20} />
        </Button>
      </Row>
      <Row label="with an icon">
        <Button>
          <Icon name="share" size={16} sw={2} />
          Share
        </Button>
        <Button variant="secondary">
          <Icon name="download" size={16} sw={2} />
          Download
        </Button>
      </Row>
      <Row label="disabled">
        <Button disabled>Save changes</Button>
        <Button variant="secondary" disabled>
          Cancel
        </Button>
        <Button variant="destructive" disabled>
          Delete
        </Button>
      </Row>
      <div className="grid gap-2.5">
        <div className="text-footnote text-muted-foreground">size=&quot;pill&quot;</div>
        <Button size="pill">Export Wei.vcf</Button>
        <Button size="pill" variant="secondary">
          Cancel
        </Button>
      </div>
    </div>
  )
}

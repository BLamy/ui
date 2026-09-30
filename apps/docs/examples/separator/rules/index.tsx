import { Separator } from '@/components/ui/separator'

const SETTINGS = ['Wi-Fi', 'Bluetooth', 'Cellular', 'Personal Hotspot']

// Three uses: a full-width rule between blocks of content, an inset rule that
// stops short of the leading edge like an iOS list, and a vertical rule
// between inline items (it stretches to the row's height).
export default function Rules() {
  return (
    <div className="mx-auto grid max-w-md gap-6">
      <div className="grid gap-3 rounded-card bg-card p-4 shadow-hairline">
        <div className="text-body font-semibold text-foreground">Release notes</div>
        <Separator />
        <p className="m-0 text-subhead text-muted-foreground">Faster launch, a calmer sidebar, and fixes for dark mode.</p>
      </div>

      <div className="overflow-hidden rounded-card bg-card shadow-hairline">
        {SETTINGS.map((name, i) => (
          <div key={name}>
            {i > 0 && <Separator inset />}
            <div className="flex h-row items-center px-4 text-body text-foreground">{name}</div>
          </div>
        ))}
      </div>

      <div className="flex h-5 items-center gap-3 text-subhead text-primary">
        <span>Docs</span>
        <Separator orientation="vertical" />
        <span>Components</span>
        <Separator orientation="vertical" />
        <span>Themes</span>
      </div>
    </div>
  )
}

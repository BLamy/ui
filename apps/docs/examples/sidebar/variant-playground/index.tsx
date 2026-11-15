import { useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarItem,
  SidebarProvider,
  SidebarSearch,
  SidebarSection,
  SidebarTrigger,
  SidebarAccount,
  type SidebarPresentation,
  type SidebarVariant,
} from '@/components/ui/sidebar'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const variants: SidebarVariant[] = ['docked', 'rail', 'float']
const presentations: SidebarPresentation[] = ['auto', 'column', 'drawer']
const pages = [
  { section: 'Workspace', icon: 'house', title: 'Home' },
  { section: 'Workspace', icon: 'bolt', title: 'Agent tasks', trailing: 4 },
  { section: 'Workspace', icon: 'tray', title: 'Inbox' },
  { section: 'Objects', icon: 'cube', title: 'Suppliers' },
  { section: 'Objects', icon: 'cube', title: 'Inventory' },
]

// One Sidebar: three looks (`variant`) and two presentations (`presentation`).
// `auto` is a column, or a drawer while the provider is narrower than its
// `breakpoint`: try the narrow container. The trigger toggles whichever shows.
export default function SidebarPlayground() {
  const [variant, setVariant] = useState<SidebarVariant>('docked')
  const [presentation, setPresentation] = useState<SidebarPresentation>('auto')
  const [narrow, setNarrow] = useState(false)
  const [page, setPage] = useState('Home')
  return (
    <div className="grid justify-items-center gap-3 p-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Segmented aria-label="Variant" value={variant} onValueChange={(v) => setVariant(v as SidebarVariant)}>
          {variants.map((v) => <SegmentedItem key={v} value={v}>{v}</SegmentedItem>)}
        </Segmented>
        <Segmented aria-label="Presentation" value={presentation} onValueChange={(v) => setPresentation(v as SidebarPresentation)}>
          {presentations.map((p) => <SegmentedItem key={p} value={p}>{p}</SegmentedItem>)}
        </Segmented>
        <label className="flex items-center gap-2 text-footnote text-foreground">
          <Switch checked={narrow} onCheckedChange={setNarrow} />
          Narrow container
        </label>
      </div>
      <div
        className={cn(
          'h-[360px] max-w-[680px] overflow-hidden rounded-card shadow-hairline transition-[width] duration-spring-smooth ease-spring-smooth',
          narrow ? 'w-[380px]' : 'w-full',
        )}
      >
        {/* Remounted per look and presentation, so each starts in its default state. */}
        <SidebarProvider key={variant + presentation} defaultOpen={presentation !== 'drawer'} breakpoint={430}>
          <Sidebar variant={variant} presentation={presentation}>
            <SidebarHeader>
              <SidebarAccount title="Creamery Ops" description="Production workspace" />
            </SidebarHeader>
            <SidebarContent aria-label="Creamery Ops">
              <SidebarSearch shortcut="/" />
              <SidebarItem icon="plus" title="New task" tint="var(--primary)" />
              {['Workspace', 'Objects'].map((section) => (
                <SidebarSection key={section} title={section}>
                  {pages.filter((p) => p.section === section).map((p) => (
                    <SidebarItem
                      key={p.title}
                      icon={p.icon}
                      title={p.title}
                      trailing={p.trailing}
                      current={page === p.title}
                      onClick={() => setPage(p.title)}
                    />
                  ))}
                </SidebarSection>
              ))}
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
              <SidebarTrigger shortcut="mod+b" />
              <strong className="text-footnote text-foreground">{page}</strong>
            </header>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}

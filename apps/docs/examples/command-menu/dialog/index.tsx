import { useState } from 'react'
import {
  Button,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandMenu,
  Kbd,
  KbdGroup,
} from '@brett_lamy/ui'

const pages = ['Introduction', 'Installation', 'Theming', 'Motion', 'Haptics', 'Composer', 'Toast', 'NavigationStack', 'SplitView', 'CommandMenu']

export default function DialogPalette() {
  const [open, setOpen] = useState(false)
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const [page, setPage] = useState('Introduction')
  return (
    // The dialog portals into `layer`, so its scrim covers this frame and it keeps the demo's theme.
    <div style={{ position: 'relative', height: 460, width: '100%', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
        <Button variant="secondary" onPress={() => setOpen(true)}>
          Search docs…
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Viewing {page}</span>
      </div>
      <div ref={setLayer} style={{ display: 'contents' }} />
      <CommandMenu
        variant="dialog"
        isOpen={open}
        onOpenChange={setOpen}
        hotkey="mod+k"
        container={layer}
        aria-label="Search docs"
        style={{ maxWidth: 480 }}
      >
        <CommandInput placeholder="Search pages…" />
        <CommandList maxHeight={260}>
          <CommandEmpty />
          <CommandGroup heading="Pages">
            {pages.map((p) => (
              <CommandItem key={p} icon="doc-text" title={p} onSelect={() => setPage(p)} />
            ))}
          </CommandGroup>
          <CommandGroup heading="Theme">
            <CommandItem icon="moon" title="Toggle dark mode" keywords={['appearance', 'light']} closeOnSelect={false} />
          </CommandGroup>
        </CommandList>
        <CommandFooter />
      </CommandMenu>
    </div>
  )
}

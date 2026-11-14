import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CommandMenu, CommandMenuDialog, CommandMenuDialogContent, CommandMenuEmpty, CommandMenuFooter,
  CommandMenuGroup, CommandMenuGroupLabel, CommandMenuInput, CommandMenuItem, CommandMenuList,
} from '@/components/ui/command-menu'
import { DialogTrigger } from '@/components/ui/dialog'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

const pages = ['Introduction', 'Installation', 'Theming', 'Motion', 'Composer', 'Toast', 'NavigationStack', 'SplitView', 'CommandMenu']

export default function DialogPalette() {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const [page, setPage] = useState('Introduction')
  return (
    // The dialog renders into `layer`, so its scrim covers this frame and it keeps the demo's theme.
    <div style={{ position: 'relative', height: 460, width: '100%', display: 'grid', placeItems: 'center' }}>
      <CommandMenuDialog container={layer}>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          {/* `shortcut` opens the palette from anywhere on the page. */}
          <DialogTrigger shortcut="mod+k" render={<Button variant="secondary" />}>
            Search docs…
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </DialogTrigger>
          <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Viewing {page}</span>
        </div>
        <CommandMenuDialogContent aria-label="Search docs" style={{ maxWidth: 480 }}>
          <CommandMenu onAction={(value) => { if (pages.includes(value)) setPage(value) }}>
            <CommandMenuInput placeholder="Search pages…" />
            <CommandMenuEmpty />
            <CommandMenuList className="max-h-65">
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Pages</CommandMenuGroupLabel>
                {pages.map((p) => (
                  <CommandMenuItem key={p} icon="doc-text" title={p} />
                ))}
              </CommandMenuGroup>
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Theme</CommandMenuGroupLabel>
                {/* closeOnSelect={false} keeps the palette open after it runs. */}
                <CommandMenuItem value="dark-mode" icon="moon" title="Toggle dark mode" keywords={['appearance', 'light']} closeOnSelect={false} />
              </CommandMenuGroup>
            </CommandMenuList>
            <CommandMenuFooter />
          </CommandMenu>
        </CommandMenuDialogContent>
      </CommandMenuDialog>
      <div ref={setLayer} style={{ display: 'contents' }} />
    </div>
  )
}

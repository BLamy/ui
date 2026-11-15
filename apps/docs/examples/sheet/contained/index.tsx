import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Sheet, SheetBackdrop, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { BLProvider } from '@/lib/theme'

const folders = ['Inbox', 'Drafts', 'Sent', 'Archive']

// `contained` keeps the sheet inside its positioned parent: here the right
// half of the window. The scrim, the focus trap and Escape stay in that box,
// so the toolbar above it stays usable. `variant="panel"` is a full-height
// edge panel with no chrome: its children are the whole panel. "Beside the
// page" is `modal={false}`: no scrim, and the box behind it stays live.
export default function Contained({ variant = 'modal' }: { variant?: string }) {
  const [folder, setFolder] = useState('Inbox')
  const modal = variant !== 'beside'
  return (
    <div className="mx-auto h-[380px] max-w-xl overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <div className="flex h-full flex-col">
          <header className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-subhead">
            <strong className="flex-1">Mail</strong>
            <span className="text-muted-foreground">{folder}</span>
          </header>
          <div className="relative min-h-0 flex-1 bg-muted">
            <Sheet key={variant} contained side="start" modal={modal}>
              <div className="p-5">
                <SheetTrigger className={buttonVariants({ variant: 'secondary' })}>Folders</SheetTrigger>
              </div>
              {modal ? <SheetBackdrop /> : null}
              <SheetContent variant="panel" aria-label="Folders" className="w-60 p-2">
                {folders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFolder(f)}
                    aria-current={f === folder || undefined}
                    className="block w-full cursor-pointer rounded-ctl border-0 bg-transparent px-3 py-2 text-start text-body text-foreground hover:bg-secondary aria-[current]:bg-secondary-strong"
                  >
                    {f}
                  </button>
                ))}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </BLProvider>
    </div>
  )
}

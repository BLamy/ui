import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,  DialogBack,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogView,
} from '@/components/ui/dialog'
import { ListRow } from '@/components/ui/list'
import { Icon } from '@/lib/icon'
import { BLProvider } from '@/lib/theme'

export default function ShareContact() {
  const [view, setView] = useState<'menu' | 'done' | null>(null)
  const done = () => setView('done')
  return (
    // Popups render into BLProvider's root: the dialog and its scrim cover
    // this box, not the page.
    <div style={{ height: 320 }}>
      <BLProvider className="grid place-items-center bg-transparent">
        <Button onClick={() => setView('menu')}>Share Contact…</Button>
        {/* `view` keys each state; the card spring-morphs its height between
          them */}
        <Dialog
          open={view !== null}
          onOpenChange={(open) => {
            if (!open) setView(null)
          }}
          view={view ?? 'menu'}
        >
          <DialogBackdrop />
          <DialogContent variant="tray">
            <DialogHeader variant="bar">
              <DialogBack
                hidden={view !== 'done'}
                onClick={() => setView('menu')}
              />
              <DialogTitle>
                {view === 'done' ? 'Shared' : 'Share Contact'}
              </DialogTitle>
              <DialogClose />
            </DialogHeader>
            <DialogView>
              {view === 'done' ? (
                <div style={{ textAlign: 'center', padding: '26px 18px' }}>
                  <span
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: '50%',
                      background: 'rgba(52,199,89,.15)',
                      display: 'inline-grid',
                      placeItems: 'center',
                      color: 'var(--success)',
                    }}
                  >
                    <Icon name="check" size={24} sw={2.4} />
                  </span>
                  <div style={{ fontWeight: 650, fontSize: 16, marginTop: 10 }}>
                    Contact shared
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--muted-foreground)',
                      marginTop: 3,
                    }}
                  >
                    The card spring-morphs its height to each state.
                  </div>
                </div>
              ) : (
                <div style={{ padding: '4px 6px 8px' }}>
                  <ListRow
                    icon={<Icon name="layers" size={20} />}
                    title="Show QR code"
                    onClick={done}
                  />
                  <ListRow
                    icon={<Icon name="mail" size={20} />}
                    title="Copy vCard"
                    divider={false}
                    onClick={done}
                  />
                </div>
              )}
            </DialogView>
          </DialogContent>
        </Dialog>
      </BLProvider>
    </div>
  )
}

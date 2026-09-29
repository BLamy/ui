import { useState } from 'react'
import { Button, Credenza, Haptics, Icon, ListRow } from '@brett_lamy/ui'

export default function ShareContact() {
  const [view, setView] = useState<'menu' | 'done' | null>(null)
  const done = () => {
    Haptics.notification('success')
    setView('done')
  }
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 210 }}>
      <Button
        onPress={() => {
          Haptics.impact('light')
          setView('menu')
        }}
      >
        Share Contact…
      </Button>
      {/* `view` keys each state; the card spring-morphs its height between
          them */}
      <Credenza
        open={view !== null}
        view={view ?? 'menu'}
        title={view === 'done' ? 'Shared' : 'Share Contact'}
        canBack={view === 'done'}
        onBack={() => setView('menu')}
        onClose={() => setView(null)}
      >
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
              style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 3 }}
            >
              The card spring-morphs its height to each state.
            </div>
          </div>
        ) : (
          <div style={{ padding: '4px 6px 8px' }}>
            <ListRow
              leading={<Icon name="layers" size={20} />}
              title="Show QR code"
              onPress={done}
            />
            <ListRow
              leading={<Icon name="mail" size={20} />}
              title="Copy vCard"
              divider={false}
              onPress={done}
            />
          </div>
        )}
      </Credenza>
    </div>
  )
}

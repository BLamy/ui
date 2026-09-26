/* Credenza page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState } from 'react'
import {
  Avatar,
  Button,
  Credenza,
  Haptics,
  Icon,
  ListRow,
  QRSvg,
  Segmented,
} from '@brett_lamy/ui'
import raw from './credenza.tsx?raw'
import { Window, examples } from './chrome'

// #region credenza_transfer
type Step = 'amount' | 'review' | 'sent'
const titles: Record<Step, string> = {
  amount: 'Send to Maya',
  review: 'Review',
  sent: 'Sent',
}
const amounts = [
  { id: '20', label: '$20' },
  { id: '50', label: '$50' },
  { id: '120', label: '$120' },
]

export function SendMoneyTray() {
  const [step, setStep] = useState<Step | null>('amount')
  const [amount, setAmount] = useState('50')
  const send = () => {
    Haptics.notification('success')
    setStep('sent')
  }
  return (
    <div
      style={{ position: 'relative', height: 460, display: 'grid', placeItems: 'center' }}
    >
      <Button onPress={() => setStep('amount')}>Send money</Button>
      {/* compact: a floating bottom tray you can drag down to dismiss */}
      <Credenza
        compact
        open={step !== null}
        view={step ?? 'amount'}
        title={titles[step ?? 'amount']}
        canBack={step === 'review'}
        onBack={() => setStep('amount')}
        onClose={() => setStep(null)}
      >
        {step === 'sent' ? (
          <div style={{ padding: '18px 20px 24px', textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: 52,
                height: 52,
                borderRadius: 52,
                background: 'var(--bl-green)',
                color: '#fff',
              }}
            >
              <Icon name="check" size={28} sw={2.6} />
            </span>
            <div style={{ fontSize: 17, fontWeight: 650, marginTop: 10 }}>
              ${amount} sent to Maya
            </div>
            <Button
              size="pill"
              variant="secondary"
              style={{ marginTop: 18 }}
              onPress={() => setStep(null)}
            >
              Done
            </Button>
          </div>
        ) : step === 'review' ? (
          <div style={{ padding: '6px 16px 16px' }}>
            <ListRow
              leading={<Avatar c={{ f: 'Maya', l: 'Lindqvist' }} size={36} />}
              title="Maya Lindqvist"
              subtitle="maya@example.com"
            />
            <ListRow title="Amount" trailing={<strong>${amount}</strong>} />
            <ListRow
              title="Fee"
              trailing={<span style={{ color: 'var(--bl-label2)' }}>Free</span>}
              divider={false}
            />
            <Button size="pill" style={{ marginTop: 12 }} onPress={send}>
              Send ${amount}
            </Button>
          </div>
        ) : (
          <div style={{ padding: '6px 16px 16px' }}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 750,
                textAlign: 'center',
                margin: '8px 0 14px',
              }}
            >
              ${amount}
            </div>
            <Segmented
              aria-label="Amount"
              options={amounts}
              value={amount}
              onChange={setAmount}
            />
            <Button size="pill" style={{ marginTop: 16 }} onPress={() => setStep('review')}>
              Continue
            </Button>
          </div>
        )}
      </Credenza>
    </div>
  )
}
// #endregion

// #region credenza_confirm
const photos = ['#FF9F0A', '#30B0C7', '#5E5CE6', '#FF375F', '#34C759', '#0A84FF']

export function ConfirmDelete() {
  const [confirming, setConfirming] = useState(false)
  const [left, setLeft] = useState(photos)
  const selected = left.slice(0, 3)
  return (
    <div
      style={{ position: 'relative', height: 380, padding: 20, boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <strong style={{ flex: 1, fontSize: 17 }}>
          Recents · {selected.length} selected
        </strong>
        <Button
          variant="destructive"
          size="sm"
          isDisabled={!selected.length}
          onPress={() => setConfirming(true)}
        >
          <Icon name="trash" size={17} /> Delete
        </Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {left.map((c, i) => (
          <div
            key={c}
            style={{
              height: 90,
              borderRadius: 10,
              background: c,
              opacity: i < 3 ? 1 : 0.45,
              outline: i < 3 ? '3px solid var(--bl-tint)' : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
      {/* Without compact it is a centered dialog. */}
      <Credenza
        open={confirming}
        title={`Delete ${selected.length} photos?`}
        onClose={() => setConfirming(false)}
      >
        <div style={{ padding: '2px 16px 16px' }}>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 14.5,
              lineHeight: 1.45,
              color: 'var(--bl-label2)',
            }}
          >
            They move to Recently Deleted and are removed for good after 30 days.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              style={{ flex: 1 }}
              onPress={() => {
                Haptics.notification('warning')
                setLeft((l) => (l.length > 3 ? l.slice(3) : photos))
                setConfirming(false)
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Credenza>
    </div>
  )
}
// #endregion

// #region credenza_share
const recipients = [
  { f: 'Maya', l: 'Lindqvist' },
  { f: 'Jonas', l: 'Ito' },
  { f: 'Priya', l: 'Raman' },
  { f: 'Leo', l: 'Okafor' },
]

export function ShareSheet() {
  const [view, setView] = useState<'share' | 'qr' | null>('share')
  const [copied, setCopied] = useState(false)
  return (
    <div
      style={{ position: 'relative', height: 480, display: 'grid', placeItems: 'center' }}
    >
      <Button
        variant="secondary"
        onPress={() => {
          setCopied(false)
          setView('share')
        }}
      >
        <Icon name="share" size={18} /> Share album
      </Button>
      <Credenza
        compact
        open={view !== null}
        view={view ?? 'share'}
        title={view === 'qr' ? 'Scan to open' : 'Summer 2026'}
        canBack={view === 'qr'}
        onBack={() => setView('share')}
        onClose={() => setView(null)}
      >
        {view === 'qr' ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 26px' }}>
            <QRSvg seed="https://example.com/albums/summer-2026" size={168} />
          </div>
        ) : (
          <div style={{ padding: '4px 8px 10px' }}>
            <div
              style={{
                display: 'flex',
                gap: 14,
                padding: '6px 10px 14px',
                overflowX: 'auto',
              }}
            >
              {recipients.map((p) => (
                <button
                  key={p.f}
                  type="button"
                  onClick={() => setView(null)}
                  style={{
                    border: 0,
                    background: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <Avatar c={p} size={52} />
                  <div style={{ fontSize: 11.5, marginTop: 5 }}>{p.f}</div>
                </button>
              ))}
            </div>
            <ListRow
              leading={<Icon name="link" size={20} />}
              title={copied ? 'Copied' : 'Copy Link'}
              onPress={() => {
                Haptics.notification('success')
                setCopied(true)
              }}
            />
            <ListRow
              leading={<Icon name="layers" size={20} />}
              title="Show QR Code"
              accessory="chevron"
              onPress={() => setView('qr')}
            />
            <ListRow
              leading={<Icon name="mail" size={20} />}
              title="Email"
              divider={false}
              onPress={() => setView(null)}
            />
          </div>
        )}
      </Credenza>
    </div>
  )
}
// #endregion

export const CREDENZA_LIVE = examples(raw, [
  {
    id: 'credenza_transfer',
    title: 'Multi-step tray · amount, review, sent',
    h: 490,
    Render: () => (
      <Window width={430} bg="var(--bl-bg2)">
        <SendMoneyTray />
      </Window>
    ),
  },
  {
    id: 'credenza_confirm',
    title: 'Destructive confirmation dialog',
    h: 410,
    Render: () => (
      <Window>
        <ConfirmDelete />
      </Window>
    ),
  },
  {
    id: 'credenza_share',
    title: 'Share sheet with a QR step',
    h: 510,
    Render: () => (
      <Window width={430} bg="var(--bl-bg2)">
        <ShareSheet />
      </Window>
    ),
  },
])

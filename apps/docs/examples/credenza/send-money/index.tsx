import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Button,
  Credenza,
  Haptics,
  Icon,
  ListRow,
  Segmented,
} from '@brett_lamy/ui'

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

function SendMoneyTray() {
  const [step, setStep] = useState<Step | null>('amount')
  const [amount, setAmount] = useState('50')
  const send = () => {
    Haptics.notification('success')
    setStep('sent')
  }
  return (
    <div
      style={{
        position: 'relative',
        height: 460,
        display: 'grid',
        placeItems: 'center',
      }}
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
                background: 'var(--success)',
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
              trailing={<span style={{ color: 'var(--muted-foreground)' }}>Free</span>}
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
            <Button
              size="pill"
              style={{ marginTop: 16 }}
              onPress={() => setStep('review')}
            >
              Continue
            </Button>
          </div>
        )}
      </Credenza>
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it,
// centered.
function Window({
  width,
  bg = 'var(--background)',
  children,
}: {
  width?: number
  bg?: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: bg,
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function SendMoney() {
  return (
    <Window width={430} bg="var(--muted)">
      <SendMoneyTray />
    </Window>
  )
}

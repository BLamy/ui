import { useEffect, useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Celebrate } from '@/components/ui/celebrate'
import { Credenza } from '@/components/ui/credenza'
import { ListRow } from '@/components/ui/list'
import { Segmented } from '@/components/ui/segmented'
import { Icon } from '@/lib/icon'

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

// Sending money is a rare moment, so it may celebrate. A beat after the view
// lands, the check pops in and a burst plays behind it — once per arrival,
// however often the view re-renders. Celebrate keeps only its ring under
// reduced motion.
function Sent({ amount, onDone }: { amount: string; onDone: () => void }) {
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), 300)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ padding: '36px 20px 24px', textAlign: 'center' }}>
      <span className="relative isolate inline-grid">
        <Celebrate fire={landed} spread={60} count={18} />
        <span
          className={
            'grid size-[52px] place-items-center rounded-full bg-success ' +
            'text-white transition-[scale,opacity] duration-spring-bouncy ' +
            'ease-spring-bouncy motion-reduce:transition-none ' +
            (landed ? 'scale-100' : 'scale-50 opacity-0')
          }
        >
          <Icon name="check" size={28} sw={2.6} />
        </span>
      </span>
      <div
        role="status"
        style={{ fontSize: 17, fontWeight: 650, marginTop: 10 }}
      >
        ${amount} sent to Maya
      </div>
      <Button
        size="pill"
        variant="secondary"
        style={{ marginTop: 18 }}
        onPress={onDone}
      >
        Done
      </Button>
    </div>
  )
}

function SendMoneyTray() {
  const [step, setStep] = useState<Step | null>('amount')
  const [amount, setAmount] = useState('50')
  const send = () => setStep('sent')
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
          <Sent amount={amount} onDone={() => setStep(null)} />
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

import { useEffect, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Celebrate } from '@/components/ui/celebrate'
import { Credenza } from '@/components/ui/credenza'
import { Form } from '@/components/ui/form'
import { IconSwap } from '@/components/ui/icon-swap'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ListRow } from '@/components/ui/list'
import { Radio, RadioGroup } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { FieldError, TextField } from '@/components/ui/text-field'
import { TextMorph } from '@/components/ui/text-morph'
import { Icon } from '@/lib/icon'
import { cn } from '@/lib/utils'

type View = 'plans' | 'checkout' | 'done'
type Card = { number: string; expiry: string; cvc: string; name: string }

const titles: Record<View, string> = {
  plans: 'Lumen Pro',
  checkout: 'Payment',
  done: 'Welcome to Pro',
}
const plans = {
  yearly: {
    label: 'Yearly',
    price: 59.99,
    per: 'year',
    note: '$5.00 a month, billed once a year',
  },
  monthly: {
    label: 'Monthly',
    price: 7.99,
    per: 'month',
    note: 'Billed every month',
  },
}
type Plan = keyof typeof plans
const perks = [
  ['photo', 'Unlimited full-resolution exports'],
  ['layers', 'All 120 presets and film looks'],
  ['cloud', 'Your edits on every device'],
]
// The photo library behind the gate: gradients of the theme's chart colors.
const shots = [
  'from-chart-3 to-chart-4',
  'from-chart-1 to-chart-5',
  'from-chart-2 to-chart-1',
  'from-chart-5 to-chart-4',
  'from-chart-3 to-chart-2',
  'from-chart-4 to-chart-5',
  'from-chart-1 to-chart-2',
  'from-chart-5 to-chart-3',
  'from-chart-2 to-chart-3',
  'from-chart-4 to-chart-1',
  'from-chart-1 to-chart-3',
  'from-chart-3 to-chart-5',
]
// A plan is a radio drawn as a card; the chosen one is tinted and ringed.
const planCard = cn(
  'w-full rounded-card bg-secondary px-3.5 py-3 ring-primary',
  'transition-[box-shadow,background-color] duration-spring-snappy',
  'ease-spring-snappy data-selected:bg-primary/10 data-selected:ring-2',
)
const empty: Card = { number: '', expiry: '', cvc: '', name: '' }
const DECLINED = '4000000000000002'
const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/* ── The mock card form: formatting and checks, nothing is sent ── */

const digits = (v: string) => v.replace(/\D/g, '')

function brandOf(number: string) {
  const d = digits(number)
  if (/^4/.test(d)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'Amex'
  if (/^6(011|5)/.test(d)) return 'Discover'
  return null
}

// 4242 4242 4242 4242, or 3782 822463 10005 for American Express.
function formatNumber(v: string) {
  const amex = brandOf(v) === 'Amex'
  let rest = digits(v).slice(0, amex ? 15 : 16)
  const groups: string[] = []
  for (const size of amex ? [4, 6, 5] : [4, 4, 4, 4]) {
    if (!rest) break
    groups.push(rest.slice(0, size))
    rest = rest.slice(size)
  }
  return groups.join(' ')
}

// MM / YY. A leading 2–9 can only be a month, so "4" becomes "04".
function formatExpiry(v: string) {
  let d = digits(v).slice(0, 4)
  if (/^[2-9]/.test(d)) d = ('0' + d).slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d
}

// The Luhn checksum every card number carries in its last digit.
function luhn(d: string) {
  let sum = 0
  for (let i = 0; i < d.length; i++) {
    const n = Number(d[d.length - 1 - i])
    sum += i % 2 ? (n > 4 ? n * 2 - 9 : n * 2) : n
  }
  return sum % 10 === 0
}

function numberError(v: string) {
  const d = digits(v)
  if (!d) return 'Enter your card number.'
  const valid = d.length === (brandOf(d) === 'Amex' ? 15 : 16) && luhn(d)
  return valid ? null : 'That card number isn’t valid.'
}

function expiryError(v: string) {
  const d = digits(v)
  if (d.length < 4) return 'Enter it as MM / YY.'
  const month = Number(d.slice(0, 2))
  if (month < 1 || month > 12) return 'That month doesn’t exist.'
  // A card works until the end of its month.
  return new Date(2000 + Number(d.slice(2)), month) > new Date()
    ? null
    : 'This card has expired.'
}

// Amex prints four digits on the front; everyone else three on the back.
const cvcError = (amex: boolean) => (v: string) =>
  digits(v).length === (amex ? 4 : 3)
    ? null
    : `Enter the ${amex ? 4 : 3} digits on the ${amex ? 'front' : 'back'}.`

function renewal(plan: Plan) {
  const d = new Date()
  if (plan === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const testCard = (): Card => ({
  number: '4242 4242 4242 4242',
  expiry: `12 / ${String(new Date().getFullYear() + 3).slice(2)}`,
  cvc: '123',
  name: 'Maya Lindqvist',
})

// setTimeout, cancelled if the demo unmounts first.
function useLater() {
  const [timers] = useState(() => new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => () => timers.forEach(clearTimeout), [timers])
  return (ms: number, run: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t)
      run()
    }, ms)
    timers.add(t)
  }
}

// `isDismissable={false}`: no close button, and Escape, the scrim and a drag
// down leave the gate up. Subscribing is the only way through: `open` follows
// `locked`.
function LumenPaywall({ compact }: { compact: boolean }) {
  const later = useLater()
  const [locked, setLocked] = useState(true)
  const [view, setView] = useState<View>('plans')
  const [plan, setPlan] = useState<Plan>('yearly')
  const [card, setCard] = useState<Card>(empty)
  // The processing step being shown, while the mock payment runs.
  const [status, setStatus] = useState<string | null>(null)
  const [declined, setDeclined] = useState<Record<string, string>>({})
  const edit = (field: keyof Card, value: string) =>
    setCard((c) => ({ ...c, [field]: value }))
  const amex = brandOf(card.number) === 'Amex'
  const busy = status !== null

  const pay = () => {
    if (busy) return
    setDeclined({})
    setStatus('Contacting your bank…')
    later(1100, () => setStatus('Confirming payment…'))
    later(2300, () => {
      setStatus(null)
      // The form maps the "server's" answer onto the card number field.
      if (digits(card.number) === DECLINED)
        setDeclined({ number: 'Your card was declined. Try another card.' })
      else setView('done')
    })
  }
  const relock = () => {
    setView('plans')
    setCard(empty)
    setLocked(true)
  }

  return (
    <>
      <Library compact={compact} locked={locked} onRelock={relock} />
      <Credenza
        open={locked}
        isDismissable={false}
        compact={compact}
        view={view}
        title={titles[view]}
        canBack={view === 'checkout' && !busy}
        onBack={() => setView('plans')}
      >
        {view === 'plans' ? (
          <div className="px-4 pt-1 pb-4">
            <p className="m-0 text-subhead text-foreground/70">
              Your free trial has ended. Choose a plan to keep editing — your
              library and edits are safe.
            </p>
            <div className="my-4 grid gap-2.5">
              {perks.map(([icon, text]) => (
                <div
                  key={text}
                  className="flex items-center gap-3 text-subhead"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-ctl bg-primary/12 text-primary">
                    <Icon name={icon} size={16} sw={2} />
                  </span>
                  {text}
                </div>
              ))}
            </div>
            <RadioGroup
              aria-label="Plan"
              value={plan}
              onChange={(v) => setPlan(v as Plan)}
              className="gap-2"
            >
              {(Object.keys(plans) as Plan[]).map((id) => (
                <Radio key={id} value={id} className={planCard}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      {plans[id].label}
                      {id === 'yearly' ? (
                        <Badge variant="outline" className="bg-card">
                          Save 37%
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-footnote text-foreground/70">
                      {plans[id].note}
                    </span>
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {usd(plans[id].price)}
                    <span className="block text-caption font-normal text-foreground/70">
                      per {plans[id].per}
                    </span>
                  </span>
                </Radio>
              ))}
            </RadioGroup>
            <Button
              size="pill"
              className="mt-4"
              onPress={() => setView('checkout')}
            >
              Continue
            </Button>
            <p className="mt-2.5 mb-0 text-center text-caption text-foreground/70">
              Renews automatically. Cancel anytime in Settings.
            </p>
          </div>
        ) : view === 'checkout' ? (
          // react-aria's Form checks every field on submit, and each again as
          // you leave it; `validationErrors` puts the decline on the number.
          <Form
            validationErrors={declined}
            onSubmit={(e) => {
              e.preventDefault()
              pay()
            }}
            className="gap-3 px-4 pt-1 pb-4"
          >
            <div className="flex items-center gap-3 rounded-card bg-secondary px-3.5 py-3">
              <AppIcon />
              <span className="min-w-0 flex-1">
                <span className="block text-subhead font-semibold">
                  Lumen Pro · {plans[plan].label}
                </span>
                <span className="block text-footnote text-foreground/70">
                  Renews {renewal(plan)}
                </span>
              </span>
              <span className="text-subhead font-semibold tabular-nums">
                {usd(plans[plan].price)}
              </span>
            </div>
            <TextField
              name="number"
              value={card.number}
              onChange={(v) => {
                edit('number', formatNumber(v))
                // A new number answers the decline.
                if (declined.number) setDeclined({})
              }}
              validate={numberError}
              isDisabled={busy}
              inputMode="numeric"
              autoComplete="cc-number"
            >
              <div className="flex items-center justify-between">
                <Label variant="field">Card number</Label>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7"
                  isDisabled={busy}
                  onPress={() => {
                    setDeclined({})
                    setCard(testCard())
                  }}
                >
                  Use a test card
                </Button>
              </div>
              <div className="relative">
                <Input
                  data-autofocus
                  placeholder="1234 1234 1234 1234"
                  className="pr-28 tabular-nums"
                />
                {brandOf(card.number) ? (
                  <Badge
                    variant="outline"
                    className="absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    {brandOf(card.number)}
                  </Badge>
                ) : null}
              </div>
              <FieldError />
            </TextField>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                name="expiry"
                value={card.expiry}
                onChange={(v) => edit('expiry', formatExpiry(v))}
                validate={expiryError}
                isDisabled={busy}
                inputMode="numeric"
                autoComplete="cc-exp"
              >
                <Label variant="field">Expires</Label>
                <Input placeholder="MM / YY" className="tabular-nums" />
                <FieldError />
              </TextField>
              <TextField
                name="cvc"
                value={card.cvc}
                onChange={(v) => edit('cvc', digits(v).slice(0, amex ? 4 : 3))}
                validate={cvcError(amex)}
                isDisabled={busy}
                inputMode="numeric"
                autoComplete="cc-csc"
              >
                <Label variant="field">Security code</Label>
                <Input
                  placeholder={amex ? '1234' : '123'}
                  className="tabular-nums"
                />
                <FieldError />
              </TextField>
            </div>
            <TextField
              name="name"
              value={card.name}
              onChange={(v) => edit('name', v)}
              validate={(v) =>
                v.trim().length > 1 ? null : 'Enter the name on the card.'
              }
              isDisabled={busy}
              autoComplete="cc-name"
            >
              <Label variant="field">Name on card</Label>
              <Input placeholder="Maya Lindqvist" />
              <FieldError />
            </TextField>
            <Button type="submit" size="pill" isPending={busy} className="mt-1">
              <IconSwap id={busy ? 'busy' : 'idle'}>
                {busy ? (
                  <Spinner spin size={18} />
                ) : (
                  <Icon name="lock-fill" size={16} sw={2} />
                )}
              </IconSwap>
              <TextMorph>
                {busy ? 'Processing…' : `Pay ${usd(plans[plan].price)}`}
              </TextMorph>
            </Button>
            <p
              role="status"
              className="m-0 text-center text-footnote text-foreground/70"
            >
              {status ?? 'Nothing is charged. 4000 0000 0000 0002 is declined.'}
            </p>
          </Form>
        ) : (
          <Unlocked plan={plan} card={card} onStart={() => setLocked(false)} />
        )}
      </Credenza>
    </>
  )
}

// A first payment is a rare moment, so it may celebrate: a beat after the
// view lands the check pops in and a burst plays behind it, once. Celebrate
// keeps only its ring under reduced motion.
function Unlocked({
  plan,
  card,
  onStart,
}: {
  plan: Plan
  card: Card
  onStart: () => void
}) {
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), 300)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="px-4 pt-9 pb-4 text-center">
      <span className="relative isolate inline-grid">
        <Celebrate fire={landed} spread={60} />
        <span
          className={cn(
            'grid size-16 place-items-center rounded-full bg-success text-white',
            'transition-[scale,opacity] duration-spring-bouncy ease-spring-bouncy',
            'motion-reduce:transition-none',
            landed ? 'scale-100' : 'scale-50 opacity-0',
          )}
        >
          <Icon name="check" size={34} sw={2.6} />
        </span>
      </span>
      <p role="status" className="mt-3 mb-1 text-title font-bold">
        Payment complete
      </p>
      <p className="m-0 text-subhead text-foreground/70">
        Lumen Pro is unlocked on all your devices.
      </p>
      <div className="mt-4 overflow-hidden rounded-card text-left shadow-hairline">
        <ListRow
          title="Plan"
          trailing={
            <span className="text-foreground/70">
              Pro · {plans[plan].label}
            </span>
          }
        />
        <ListRow
          title="Paid today"
          trailing={
            <span className="text-foreground/70 tabular-nums">
              {usd(plans[plan].price)}
            </span>
          }
        />
        <ListRow
          title="Card"
          trailing={
            <span className="text-foreground/70">
              {brandOf(card.number)} •••• {digits(card.number).slice(-4)}
            </span>
          }
          divider={false}
        />
      </div>
      <Button data-autofocus size="pill" className="mt-4" onPress={onStart}>
        Start editing
      </Button>
    </div>
  )
}

function AppIcon() {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-ctl text-white',
        'bg-linear-to-br from-chart-3 to-chart-4',
      )}
    >
      <Icon name="photo" size={17} sw={2} />
    </span>
  )
}

// The app the paywall blocks.
function Library({
  compact,
  locked,
  onRelock,
}: {
  compact: boolean
  locked: boolean
  onRelock: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2.5 px-4 py-3 shadow-hairline-b">
        <AppIcon />
        <span className="flex-1 text-callout font-semibold">Lumen</span>
        {locked ? (
          <Badge variant="outline">Trial ended</Badge>
        ) : (
          <Badge variant="secondary">
            <Icon name="star-fill" size={12} /> Pro
          </Badge>
        )}
      </header>
      <div
        className={cn(
          'grid min-h-0 flex-1 content-start gap-1.5 overflow-hidden p-4',
          compact ? 'grid-cols-3' : 'grid-cols-6',
        )}
      >
        {shots.map((s) => (
          <div
            key={s}
            className={`aspect-square rounded-ctl bg-linear-to-br ${s}`}
          />
        ))}
      </div>
      {locked ? null : (
        <div className="p-4 pt-0">
          <Button variant="secondary" size="pill" onPress={onRelock}>
            Show the paywall again
          </Button>
        </div>
      )}
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in: a desktop for the
// dialog, a phone for the tray.
function Window({
  compact,
  children,
}: {
  compact: boolean
  children: ReactNode
}) {
  return (
    <div
      style={{ maxWidth: compact ? 390 : undefined }}
      className={cn(
        'relative isolate mx-auto w-full overflow-hidden rounded-card',
        'bg-background leading-[normal] text-foreground',
        'shadow-[0_0_0_1px_var(--border),0_10px_30px_--alpha(black/6%)]',
        compact ? 'h-[680px]' : 'h-[600px]',
      )}
    >
      {children}
    </div>
  )
}

// The variant picks the host: a desktop gets the dialog, a phone the tray. In
// an app, `compact` comes from your layout (a width class), and the flow keeps
// its place when it changes.
export default function Paywall({ variant = 'dialog' }: { variant?: string }) {
  const compact = variant === 'tray'
  return (
    <Window compact={compact}>
      <LumenPaywall compact={compact} />
    </Window>
  )
}

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Celebrate } from '@/components/ui/celebrate'
import { Checkbox } from '@/components/ui/checkbox'
import { Credenza } from '@/components/ui/credenza'
import { FileUploadButton } from '@/components/ui/file-upload'
import { Form } from '@/components/ui/form'
import { IconSwap } from '@/components/ui/icon-swap'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ListRow } from '@/components/ui/list'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { FieldError, TextField } from '@/components/ui/text-field'
import { TextMorph } from '@/components/ui/text-morph'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Icon } from '@/lib/icon'
import { cn } from '@/lib/utils'

const steps = [
  'account',
  'verify',
  'profile',
  'topics',
  'notify',
  'done',
] as const
type Step = (typeof steps)[number]

const titles: Record<Step, string> = {
  account: 'Create your account',
  verify: 'Check your email',
  profile: 'Make it yours',
  topics: 'Pick your topics',
  notify: 'Stay in the loop',
  done: 'Welcome to Orbit',
}
// The code the pretend email brings.
const CODE = '284615'
const looks = [
  { id: 'blue', label: 'Blue', color: 'var(--chart-1)', dot: 'bg-chart-1' },
  { id: 'green', label: 'Green', color: 'var(--chart-2)', dot: 'bg-chart-2' },
  { id: 'orange', label: 'Orange', color: 'var(--chart-3)', dot: 'bg-chart-3' },
  { id: 'red', label: 'Red', color: 'var(--chart-4)', dot: 'bg-chart-4' },
  { id: 'purple', label: 'Purple', color: 'var(--chart-5)', dot: 'bg-chart-5' },
]
const topics = [
  { id: 'design', label: 'Design', icon: 'pencil' },
  { id: 'photo', label: 'Photography', icon: 'camera' },
  { id: 'music', label: 'Music', icon: 'music-note' },
  { id: 'travel', label: 'Travel', icon: 'airplane' },
  { id: 'books', label: 'Books', icon: 'books-vertical' },
  { id: 'tech', label: 'Tech', icon: 'laptop' },
  { id: 'film', label: 'Film', icon: 'video' },
  { id: 'outdoors', label: 'Outdoors', icon: 'sun' },
  { id: 'wellness', label: 'Wellness', icon: 'heart' },
  { id: 'money', label: 'Money', icon: 'chart-bar' },
  { id: 'world', label: 'World', icon: 'globe' },
  { id: 'garden', label: 'Gardening', icon: 'flower' },
]
const alertRows = [
  ['replies', 'Replies and mentions'],
  ['digest', 'Sunday digest'],
  ['news', 'Product news'],
] as const

const emailError = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    ? null
    : v.trim()
      ? 'Enter a full address, like maya@example.com.'
      : 'Enter your email.'

// "maya.lindqvist@example.com" → "Maya Lindqvist"
const nameFrom = (email: string) =>
  email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')

// The card draws the progress along its top edge — a track, and a fill that
// springs to each step — so it stays put while the views slide beneath it.
const progressBar = cn(
  'before:absolute before:inset-x-0 before:top-0 before:z-3 before:h-[3px]',
  'before:bg-secondary after:absolute after:inset-x-0 after:top-0 after:z-3',
  'after:h-[3px] after:origin-left after:scale-x-(--progress) after:bg-primary',
  'after:transition-transform after:duration-spring-smooth',
  'after:ease-spring-smooth motion-reduce:after:transition-none',
)

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

// Six steps in one Credenza: each is a `view`, so the card morphs to its
// height and the views slide the way the flow goes; Back is `canBack` /
// `onBack`. Each step checks its own fields before it lets you on. Closing it
// keeps your place.
function OrbitSignup({ compact }: { compact: boolean }) {
  const later = useLater()
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<Step>('account')
  const [finished, setFinished] = useState(false)
  const [busy, setBusy] = useState(false)
  // Account and verification
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null)
  const [mail, setMail] = useState(0)
  const [wait, setWait] = useState(0)
  // Profile, topics, notifications
  const [name, setName] = useState('')
  const [look, setLook] = useState('blue')
  const [photo, setPhoto] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [tooFew, setTooFew] = useState(false)
  const [alerts, setAlerts] = useState({
    replies: true,
    digest: true,
    news: false,
  })
  const [notifying, setNotifying] = useState(false)

  const index = steps.indexOf(step)
  const verified = verifiedFor === email
  const tint = looks.find((l) => l.id === look)?.color
  const avatar = (size: number) => (
    <Avatar
      name={name || email || 'You'}
      color={tint}
      src={look === 'photo' ? (photo ?? undefined) : undefined}
      size={size}
    />
  )

  // The resend countdown runs while the code step is up.
  useEffect(() => {
    if (step !== 'verify' || wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [step, wait])
  // A chosen photo is an object URL: let the old one go.
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo)
    },
    [photo],
  )

  const sendCode = () => {
    setCode('')
    setCodeError(null)
    setWait(30)
    setMail((n) => n + 1)
  }
  const createAccount = () => {
    if (busy) return
    // Back here after verifying, with the same address: nothing to send.
    if (verified) {
      setStep('verify')
      return
    }
    setBusy(true)
    later(900, () => {
      setBusy(false)
      sendCode()
      setStep('verify')
    })
  }
  const enterCode = (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 6)
    setCode(next)
    setCodeError(null)
    if (next.length < 6) return
    setBusy(true)
    later(800, () => {
      setBusy(false)
      if (next !== CODE) {
        setCode('')
        setCodeError('That code doesn’t match. Check the email and try again.')
        return
      }
      setVerifiedFor(email)
      if (!name) setName(nameFrom(email))
      // Let the boxes turn green before moving on (unless you went Back).
      later(700, () => setStep((s) => (s === 'verify' ? 'profile' : s)))
    })
  }
  const allowNotifications = () => {
    setBusy(true)
    // Stands in for the browser's permission prompt.
    later(1000, () => {
      setBusy(false)
      setNotifying(true)
      setStep('done')
    })
  }
  const startOver = () => {
    setFinished(false)
    setStep('account')
    setEmail('')
    setPassword('')
    setAgreed(false)
    setCode('')
    setVerifiedFor(null)
    setName('')
    setLook('blue')
    setPhoto(null)
    setPicked(new Set())
    setTooFew(false)
    setNotifying(false)
    setOpen(true)
  }

  return (
    <>
      <Orbit
        finished={finished}
        started={index > 0}
        avatar={avatar(48)}
        name={name}
        email={email}
        topics={topics.filter((t) => picked.has(t.id)).map((t) => t.label)}
        onOpen={() => setOpen(true)}
        onStartOver={startOver}
      />
      {open && step === 'verify' && !verified ? <Email key={mail} /> : null}
      <Credenza
        open={open}
        onClose={() => setOpen(false)}
        compact={compact}
        view={step}
        title={titles[step]}
        canBack={index > 0 && step !== 'done' && !busy}
        onBack={() => setStep(steps[index - 1])}
        className={progressBar}
        style={{ '--progress': Math.min(1, (index + 1) / 5) } as CSSProperties}
      >
        {step === 'account' ? (
          <Form
            onSubmit={(e) => {
              e.preventDefault()
              createAccount()
            }}
            className="gap-3.5 px-4 pt-1 pb-4"
          >
            <StepOf n={1} />
            <TextField
              name="email"
              type="email"
              value={email}
              onChange={setEmail}
              validate={emailError}
              isDisabled={busy}
              autoComplete="email"
            >
              <Label variant="field">Email</Label>
              <Input data-autofocus placeholder="you@example.com" />
              <FieldError />
            </TextField>
            <TextField
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
              validate={(v) =>
                v.length >= 8 ? null : 'Use at least 8 characters.'
              }
              isDisabled={busy}
              autoComplete="new-password"
            >
              <Label variant="field">Password</Label>
              <Input placeholder="8 or more characters" />
              <FieldError />
            </TextField>
            <Checkbox
              name="terms"
              isSelected={agreed}
              onChange={setAgreed}
              isDisabled={busy}
              validate={(checked) =>
                checked ? null : 'Accept the terms to continue.'
              }
              className="items-start text-subhead"
            >
              {({ isInvalid }) => (
                <span>
                  I agree to Orbit’s Terms and Privacy Policy
                  {isInvalid ? (
                    <span className="block text-footnote text-destructive">
                      Accept the terms to continue.
                    </span>
                  ) : null}
                </span>
              )}
            </Checkbox>
            <Button type="submit" size="pill" isPending={busy} className="mt-1">
              {busy ? <Spinner spin size={18} /> : null}
              <TextMorph>{busy ? 'Creating account…' : 'Continue'}</TextMorph>
            </Button>
          </Form>
        ) : step === 'verify' ? (
          <div className="grid gap-4 px-4 pt-1 pb-4">
            <StepOf n={2} />
            <p className="m-0 text-subhead text-foreground/70">
              {verified ? 'Verified ' : 'Enter the 6-digit code we sent to '}
              <b className="font-semibold text-foreground">{email}</b>
              {verified ? '.' : '. It expires in 10 minutes.'}
            </p>
            <CodeField
              value={code}
              onChange={enterCode}
              error={codeError}
              isBusy={busy}
              isVerified={verified}
            />
            {verified ? (
              <Button
                data-autofocus
                size="pill"
                onPress={() => setStep('profile')}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="justify-self-center"
                isDisabled={wait > 0 || busy}
                onPress={sendCode}
              >
                {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
              </Button>
            )}
          </div>
        ) : step === 'profile' ? (
          <Form
            onSubmit={(e) => {
              e.preventDefault()
              setStep('topics')
            }}
            className="gap-4 px-4 pt-1 pb-4"
          >
            <StepOf n={3} />
            <div className="flex flex-col items-center gap-3">
              {avatar(72)}
              <div className="flex items-center gap-2">
                <ToggleGroup
                  aria-label="Avatar"
                  disallowEmptySelection
                  selectedKeys={[look]}
                  onSelectionChange={(keys) =>
                    setLook(String([...keys][0] ?? look))
                  }
                  className="gap-1"
                >
                  {photo ? (
                    <ToggleGroupItem
                      id="photo"
                      aria-label="Your photo"
                      className={swatch}
                    >
                      <Avatar name={name} src={photo} size={28} />
                    </ToggleGroupItem>
                  ) : null}
                  {looks.map((l) => (
                    <ToggleGroupItem
                      key={l.id}
                      id={l.id}
                      aria-label={l.label}
                      className={swatch}
                    >
                      <span className={cn('size-7 rounded-full', l.dot)} />
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FileUploadButton
                  variant="secondary"
                  size="icon"
                  aria-label="Choose a photo"
                  accept={['image/*']}
                  multiple={false}
                  onFiles={([entry]) => {
                    if (!entry) return
                    setPhoto(URL.createObjectURL(entry.file))
                    setLook('photo')
                  }}
                >
                  <Icon name="camera" size={18} />
                </FileUploadButton>
              </div>
            </div>
            <TextField
              name="name"
              value={name}
              onChange={setName}
              validate={(v) =>
                v.trim().length > 1 ? null : 'Enter the name people will see.'
              }
              autoComplete="name"
            >
              <Label variant="field">Display name</Label>
              <Input data-autofocus placeholder="Maya Lindqvist" />
              <FieldError />
            </TextField>
            <Button type="submit" size="pill">
              Continue
            </Button>
          </Form>
        ) : step === 'topics' ? (
          <div className="grid gap-4 px-4 pt-1 pb-4">
            <StepOf n={4} />
            <p className="m-0 text-subhead text-foreground/70">
              Pick three or more and we’ll shape your feed around them. You can
              change them any time.
            </p>
            <ToggleGroup
              aria-label="Topics"
              selectionMode="multiple"
              selectedKeys={picked}
              onSelectionChange={(keys) => {
                setPicked(new Set([...keys].map(String)))
                setTooFew(false)
              }}
              className="w-full flex-wrap justify-center gap-2"
            >
              {topics.map((t) => (
                <ToggleGroupItem
                  key={t.id}
                  id={t.id}
                  size="sm"
                  className={chip}
                >
                  {({ isSelected }) => (
                    <>
                      <IconSwap id={isSelected ? 'on' : 'off'}>
                        <Icon
                          name={isSelected ? 'check' : t.icon}
                          size={15}
                          sw={isSelected ? 2.6 : 2}
                        />
                      </IconSwap>
                      {t.label}
                    </>
                  )}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p
              aria-live="polite"
              className={cn(
                'm-0 text-center text-footnote',
                tooFew ? 'text-destructive' : 'text-foreground/70',
              )}
            >
              {tooFew
                ? 'Pick at least three topics to continue.'
                : picked.size >= 3
                  ? `${picked.size} topics picked`
                  : `Pick ${3 - picked.size} more`}
            </p>
            <Button
              size="pill"
              onPress={() =>
                picked.size >= 3 ? setStep('notify') : setTooFew(true)
              }
            >
              Continue
            </Button>
          </div>
        ) : step === 'notify' ? (
          <div className="grid gap-3 px-4 pt-1 pb-4">
            <StepOf n={5} />
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-panel bg-primary/12 text-primary">
                <Icon name="bell-fill" size={22} />
              </span>
              <p className="m-0 text-subhead text-foreground/70">
                Hear when someone replies to you, and get a digest of your
                topics. Choose what comes through.
              </p>
            </div>
            <div className="overflow-hidden rounded-card shadow-hairline">
              {alertRows.map(([key, label], i) => (
                <ListRow
                  key={key}
                  title={label}
                  divider={i < alertRows.length - 1}
                  accessory={
                    <Switch
                      checked={alerts[key]}
                      onChange={(on) => setAlerts((a) => ({ ...a, [key]: on }))}
                    />
                  }
                />
              ))}
            </div>
            <Button
              size="pill"
              isPending={busy}
              className="mt-1"
              onPress={allowNotifications}
            >
              <IconSwap id={busy ? 'busy' : 'idle'}>
                {busy ? (
                  <Spinner spin size={18} />
                ) : (
                  <Icon name="bell" size={18} sw={2} />
                )}
              </IconSwap>
              <TextMorph>
                {busy ? 'Waiting for permission…' : 'Turn on notifications'}
              </TextMorph>
            </Button>
            <Button
              size="pill"
              variant="ghost"
              isDisabled={busy}
              onPress={() => setStep('done')}
            >
              Not now
            </Button>
          </div>
        ) : (
          <AllSet
            avatar={avatar(72)}
            name={name}
            topics={topics.filter((t) => picked.has(t.id)).map((t) => t.label)}
            note={
              !notifying
                ? 'Notifications stay off until you turn them on.'
                : alerts.replies
                  ? 'We’ll let you know when people reply.'
                  : 'Notifications are on.'
            }
            onStart={() => {
              setFinished(true)
              setOpen(false)
            }}
          />
        )}
      </Credenza>
    </>
  )
}

// Avatar swatches: a ring marks the chosen one.
const swatch = cn(
  'size-9 min-w-0 rounded-full p-0 data-selected:bg-transparent',
  'data-selected:shadow-[0_0_0_2px_var(--primary)]',
)
// Topic chips: filled with the text colour once picked.
const chip = cn(
  'rounded-full bg-secondary px-3',
  'data-selected:bg-foreground data-selected:text-background',
  'data-selected:data-hovered:bg-foreground/90',
  'data-selected:data-pressed:bg-foreground',
)

// The verification email, dropping in as a notification above everything a
// beat after the code is sent.
function Email() {
  return (
    <div
      role="status"
      className={cn(
        'absolute inset-x-3 top-3 z-402 mx-auto flex max-w-sm items-center',
        'gap-3 rounded-sheet bg-card p-3',
        'shadow-[0_12px_32px_--alpha(black/22%),0_0_0_1px_var(--border)]',
        'transition-[translate,opacity] delay-700 duration-spring-smooth',
        'ease-spring-smooth starting:-translate-y-6 starting:opacity-0',
        'motion-reduce:transition-none',
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-ctl bg-foreground text-background">
        <Icon name="envelope-fill" size={18} />
      </span>
      <span className="min-w-0 flex-1 text-footnote">
        <span className="flex justify-between font-semibold">
          Orbit <span className="font-normal text-foreground/70">now</span>
        </span>
        Your verification code is{' '}
        <b className="tracking-wider tabular-nums">{CODE}</b>
      </span>
    </div>
  )
}

function StepOf({ n }: { n: number }) {
  return (
    <p className="m-0 text-footnote font-semibold text-foreground/70">
      Step {n} of 5
    </p>
  )
}

// One real input — so typing, paste, autofill and screen readers all meet a
// single field — drawn as six boxes. It checks itself once all six are in.
function CodeField({
  value,
  onChange,
  error,
  isBusy,
  isVerified,
}: {
  value: string
  onChange: (value: string) => void
  error: string | null
  isBusy: boolean
  isVerified: boolean
}) {
  const [focused, setFocused] = useState(false)
  const at = Math.min(value.length, 5)
  return (
    <TextField
      aria-label="Verification code"
      value={isVerified ? CODE : value}
      onChange={onChange}
      isInvalid={!!error}
      isReadOnly={isBusy || isVerified}
      inputMode="numeric"
      autoComplete="one-time-code"
      className="relative gap-2"
    >
      <div aria-hidden="true" className="flex justify-center gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'grid h-13 w-11 place-items-center rounded-ctl bg-input text-title font-semibold tabular-nums',
              'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
              focused &&
                !isVerified &&
                !isBusy &&
                i === at &&
                'shadow-[inset_0_0_0_1.5px_var(--primary)]',
              error && 'shadow-[inset_0_0_0_1.5px_var(--destructive)]',
              isVerified && 'bg-success/20',
              isBusy && 'opacity-60',
            )}
          >
            {isVerified
              ? CODE[i]
              : (value[i] ?? (focused && i === at ? <Caret /> : null))}
          </span>
        ))}
      </div>
      <Input
        data-autofocus={isVerified ? undefined : true}
        // The current box shows where you are; the field itself draws no ring.
        style={{ outline: 'none' }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Keep the caret at the end: the boxes fill left to right.
        onSelect={(e) => {
          const end = e.currentTarget.value.length
          if (e.currentTarget.selectionStart !== end)
            e.currentTarget.setSelectionRange(end, end)
        }}
        className={cn(
          'absolute inset-x-0 top-0 h-13 cursor-text bg-transparent',
          'text-transparent caret-transparent selection:bg-transparent',
          'data-focused:bg-transparent data-focused:shadow-none',
          'data-invalid:shadow-none',
        )}
      />
      {error ? <FieldError className="text-center">{error}</FieldError> : null}
      {isBusy || isVerified ? (
        <p
          role="status"
          className="m-0 flex items-center justify-center gap-1.5 text-footnote text-foreground/70"
        >
          {isVerified ? (
            <Icon name="check-circle-fill" size={16} className="text-success" />
          ) : (
            <Spinner spin size={14} />
          )}
          {isVerified ? 'Email verified' : 'Checking…'}
        </p>
      ) : null}
    </TextField>
  )
}

function Caret() {
  return (
    <span className="h-6 w-0.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
  )
}

// Finishing is a rare moment, so it may celebrate: a beat after the view lands
// the burst plays behind the avatar and the check pops in, once. Celebrate
// keeps only its ring under reduced motion.
function AllSet({
  avatar,
  name,
  topics,
  note,
  onStart,
}: {
  avatar: ReactNode
  name: string
  topics: string[]
  note: string
  onStart: () => void
}) {
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), 300)
    return () => clearTimeout(t)
  }, [])
  const feed =
    topics.length > 3
      ? [...topics.slice(0, 2), `${topics.length - 2} more`]
      : topics
  return (
    <div className="px-4 pt-9 pb-4 text-center">
      <span className="relative isolate inline-grid">
        <Celebrate fire={landed} spread={60} />
        {avatar}
        <span
          className={cn(
            'absolute -right-1 -bottom-1 grid size-7 place-items-center',
            'rounded-full bg-success text-white ring-3 ring-card',
            'transition-[scale,opacity] duration-spring-bouncy',
            'ease-spring-bouncy motion-reduce:transition-none',
            landed ? 'scale-100' : 'scale-50 opacity-0',
          )}
        >
          <Icon name="check" size={16} sw={3} />
        </span>
      </span>
      <p role="status" className="mt-3 mb-1 text-title font-bold">
        You’re all set, {name.split(' ')[0]}
      </p>
      <p className="m-0 text-subhead text-foreground/70">
        Your feed follows {new Intl.ListFormat('en').format(feed)}. {note}
      </p>
      <Button data-autofocus size="pill" className="mt-5" onPress={onStart}>
        Start exploring
      </Button>
    </div>
  )
}

// The app behind the flow: a landing page, then your home once you're in.
function Orbit({
  finished,
  started,
  avatar,
  name,
  email,
  topics,
  onOpen,
  onStartOver,
}: {
  finished: boolean
  started: boolean
  avatar: ReactNode
  name: string
  email: string
  topics: string[]
  onOpen: () => void
  onStartOver: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2.5 px-4 py-3 shadow-hairline-b">
        <span
          className={cn(
            'grid size-8 place-items-center rounded-ctl text-white',
            'bg-linear-to-br from-chart-5 to-chart-1',
          )}
        >
          <Icon name="globe" size={18} sw={2} />
        </span>
        <span className="flex-1 text-callout font-semibold">Orbit</span>
        {finished ? (
          <Button variant="secondary" size="sm" onPress={onStartOver}>
            Start over
          </Button>
        ) : null}
      </header>
      {finished ? (
        <div className="grid content-start gap-4 p-5">
          <div className="flex items-center gap-3">
            {avatar}
            <div className="min-w-0">
              <p className="m-0 truncate text-callout font-semibold">{name}</p>
              <p className="m-0 truncate text-footnote text-foreground/70">
                {email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid flex-1 place-content-center justify-items-center gap-2 p-8 text-center">
          <p className="m-0 text-title font-bold">Follow what you love</p>
          <p className="m-0 max-w-xs text-subhead text-foreground/70">
            Topics, people and conversations worth your time, in one calm feed.
          </p>
          <Button size="lg" className="mt-3" onPress={onOpen}>
            {started ? 'Finish setting up' : 'Create your account'}
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

// The code is in the email that drops in at the top. The variant picks the
// host: a desktop gets the dialog, a phone the tray.
export default function Onboarding({
  variant = 'dialog',
}: {
  variant?: string
}) {
  const compact = variant === 'tray'
  return (
    <Window compact={compact}>
      <OrbitSignup compact={compact} />
    </Window>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Credenza } from '@/components/ui/credenza'
import { Form } from '@/components/ui/form'
import { IconSwap } from '@/components/ui/icon-swap'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ListRow } from '@/components/ui/list'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  FieldDescription,
  FieldError,
  TextField,
} from '@/components/ui/text-field'
import { TextMorph } from '@/components/ui/text-morph'
import { Toggle } from '@/components/ui/toggle'
import { Icon } from '@/lib/icon'
import { cn } from '@/lib/utils'

type View = 'signin' | 'register' | 'reset' | 'sent' | 'welcome'
type User = { name: string; email: string; isNew: boolean }

const titles: Record<View, string> = {
  signin: 'Sign in to Atlas',
  register: 'Create your account',
  reset: 'Reset your password',
  sent: 'Check your inbox',
  welcome: 'You’re in',
}
const docs = [
  ['Q4 planning', 'Edited 2 hours ago by Jonas'],
  ['Design review notes', 'Edited yesterday'],
  ['Hiring plan', 'Shared with you by Priya'],
  ['Launch checklist', 'Edited Monday'],
]
const strengths = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
const TAKEN = 'taken@example.com'

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

// 0–4: eight characters to count at all, then length, mixed case, and digits
// with symbols.
function strength(password: string) {
  if (password.length < 8) return 0
  return (
    1 +
    Number(password.length >= 12) +
    Number(/[a-z]/.test(password) && /[A-Z]/.test(password)) +
    Number(/\d/.test(password) && /[^A-Za-z0-9]/.test(password))
  )
}

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

// A sign-in gate over the app. Sign in, Register and Reset are views of one
// non-dismissable Credenza: switching morphs the card and slides the views,
// and the email carries across. Nothing but signing in takes it down.
function AtlasGate({ compact }: { compact: boolean }) {
  const later = useLater()
  const [view, setView] = useState<View>('signin')
  const [user, setUser] = useState<User | null>(null)
  const [entered, setEntered] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  // What the pretend server said, mapped onto fields by name.
  const [errors, setErrors] = useState<Record<string, string>>({})

  const go = (next: View) => {
    setErrors({})
    setPassword('')
    setShown(false)
    setView(next)
  }
  // A pretend round trip: the button spins, the fields wait.
  const request = (answer: () => void) => {
    setBusy(true)
    setErrors({})
    later(1200, () => {
      setBusy(false)
      answer()
    })
  }
  const signIn = () =>
    request(() => {
      setUser({ name: nameFrom(email), email, isNew: false })
      setView('welcome')
    })
  const register = () =>
    request(() => {
      if (email.trim().toLowerCase() === TAKEN) {
        setErrors({ email: 'There’s already an Atlas account for this email.' })
        return
      }
      setUser({ name: name.trim(), email, isNew: true })
      setView('welcome')
    })
  const signOut = () => {
    setUser(null)
    setEntered(false)
    setName('')
    setEmail('')
    go('signin')
  }

  const submit = (send: () => void) => (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (!busy) send()
  }
  const emailField = (
    <TextField
      name="email"
      type="email"
      value={email}
      onChange={(v) => {
        setEmail(v)
        // Editing the address answers the server's complaint about it.
        if (errors.email) setErrors({})
      }}
      validate={emailError}
      isDisabled={busy}
      autoComplete="email"
    >
      <Label variant="field">Email</Label>
      <Input
        data-autofocus={view !== 'register' ? '' : undefined}
        placeholder="you@company.com"
      />
      <FieldError />
    </TextField>
  )
  const passwordInput = (
    <div className="relative">
      <Input className="pr-12" />
      {/* A toggle button, so "pressed" is announced with its name. */}
      <Toggle
        size="sm"
        aria-label="Show password"
        isSelected={shown}
        onChange={setShown}
        className={cn(
          'absolute top-1/2 right-1.5 -translate-y-1/2 text-foreground/70',
          'data-selected:bg-transparent data-selected:text-foreground',
        )}
      >
        <IconSwap id={shown ? 'shown' : 'hidden'}>
          <Icon name={shown ? 'eye-slash' : 'eye'} size={18} />
        </IconSwap>
      </Toggle>
    </div>
  )
  const submitButton = (idle: string, working: string) => (
    <Button type="submit" size="pill" isPending={busy} className="mt-1">
      {busy ? <Spinner spin size={18} /> : null}
      <TextMorph>{busy ? working : idle}</TextMorph>
    </Button>
  )
  const switchTo = (prompt: string, label: string, next: View) => (
    <p className="m-0 text-center text-footnote text-foreground/70">
      {prompt}{' '}
      <Button
        variant="link"
        size="sm"
        className="h-auto px-0"
        isDisabled={busy}
        onPress={() => go(next)}
      >
        {label}
      </Button>
    </p>
  )

  return (
    <>
      <Atlas user={entered ? user : null} onSignOut={signOut} />
      <Credenza
        open={!entered}
        isDismissable={false}
        compact={compact}
        view={view}
        title={
          view === 'welcome' && user?.isNew ? 'Account created' : titles[view]
        }
        canBack={(view === 'reset' && !busy) || view === 'sent'}
        onBack={() => go('signin')}
      >
        {view === 'signin' ? (
          <Form
            validationErrors={errors}
            onSubmit={submit(signIn)}
            className="gap-3.5 px-4 pt-1 pb-4"
          >
            {emailField}
            <TextField
              name="password"
              type={shown ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              validate={(v) => (v ? null : 'Enter your password.')}
              isDisabled={busy}
              autoComplete="current-password"
            >
              <Label variant="field">Password</Label>
              {passwordInput}
              <FieldError />
            </TextField>
            <Button
              variant="link"
              size="sm"
              className="-mt-1.5 h-auto self-end px-1"
              isDisabled={busy}
              onPress={() => go('reset')}
            >
              Forgot password?
            </Button>
            {submitButton('Sign in', 'Signing in…')}
            {switchTo('New to Atlas?', 'Create an account', 'register')}
          </Form>
        ) : view === 'register' ? (
          <Form
            validationErrors={errors}
            onSubmit={submit(register)}
            className="gap-3.5 px-4 pt-1 pb-4"
          >
            <TextField
              name="name"
              value={name}
              onChange={setName}
              validate={(v) => (v.trim() ? null : 'Enter your name.')}
              isDisabled={busy}
              autoComplete="name"
            >
              <Label variant="field">Full name</Label>
              <Input data-autofocus placeholder="Maya Lindqvist" />
              <FieldError />
            </TextField>
            {emailField}
            <TextField
              name="password"
              type={shown ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              validate={(v) =>
                v.length >= 8 ? null : 'Use at least 8 characters.'
              }
              isDisabled={busy}
              autoComplete="new-password"
            >
              <Label variant="field">Password</Label>
              {passwordInput}
              <Strength password={password} />
              <FieldError />
            </TextField>
            <Checkbox
              name="terms"
              isDisabled={busy}
              validate={(checked) =>
                checked ? null : 'Accept the terms to continue.'
              }
              className="items-start text-subhead"
            >
              {({ isInvalid }) => (
                <span>
                  I agree to the Terms of Service and Privacy Policy
                  {isInvalid ? (
                    <span className="block text-footnote text-destructive">
                      Accept the terms to continue.
                    </span>
                  ) : null}
                </span>
              )}
            </Checkbox>
            {submitButton('Create account', 'Creating account…')}
            {switchTo('Already have an account?', 'Sign in', 'signin')}
          </Form>
        ) : view === 'reset' ? (
          <Form
            onSubmit={submit(() => request(() => setView('sent')))}
            className="gap-3.5 px-4 pt-1 pb-4"
          >
            <p className="m-0 text-subhead text-foreground/70">
              Enter the email you sign in with and we’ll send a link to choose a
              new password.
            </p>
            {emailField}
            {submitButton('Send reset link', 'Sending…')}
          </Form>
        ) : view === 'sent' ? (
          <div className="px-4 pt-2 pb-4 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/12 text-primary">
              <Icon name="envelope-badge" size={28} />
            </span>
            <p
              role="status"
              className="mt-3 mb-4 text-subhead text-foreground/70"
            >
              We sent a reset link to{' '}
              <b className="font-semibold text-foreground">{email}</b>. It works
              for one hour.
            </p>
            <Button
              data-autofocus
              size="pill"
              variant="secondary"
              onPress={() => go('signin')}
            >
              Back to sign in
            </Button>
          </div>
        ) : user ? (
          <div className="px-4 pt-3 pb-4 text-center">
            <Avatar name={user.name} size={64} className="mx-auto" />
            <p role="status" className="mt-3 mb-1 text-title font-bold">
              {user.isNew ? 'Welcome' : 'Welcome back'},{' '}
              {user.name.split(' ')[0]}
            </p>
            <p className="m-0 text-subhead text-foreground/70">
              {user.isNew
                ? `We sent a link to ${user.email} to confirm it.`
                : `Signed in as ${user.email}`}
            </p>
            <Button
              data-autofocus
              size="pill"
              className="mt-5"
              onPress={() => setEntered(true)}
            >
              Continue to Atlas
            </Button>
          </div>
        ) : null}
      </Credenza>
    </>
  )
}

// Four bars and a word, read out with the field as its description.
function Strength({ password }: { password: string }) {
  const score = strength(password)
  const fill =
    score < 2 ? 'bg-destructive' : score < 3 ? 'bg-warning' : 'bg-success'
  return (
    <div className="flex items-center gap-3 px-1">
      <div aria-hidden="true" className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-spring-smooth',
              i < score ? fill : 'bg-secondary-strong',
            )}
          />
        ))}
      </div>
      <FieldDescription className="px-0">
        {password ? strengths[score] : '8 or more characters'}
      </FieldDescription>
    </div>
  )
}

// The app behind the gate: placeholders until someone signs in.
function Atlas({
  user,
  onSignOut,
}: {
  user: User | null
  onSignOut: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2.5 px-4 py-3 shadow-hairline-b">
        <span className="grid size-8 place-items-center rounded-ctl bg-foreground text-background">
          <Icon name="globe" size={18} sw={2} />
        </span>
        <span className="flex-1 text-callout font-semibold">Atlas</span>
        {user ? (
          <>
            <Avatar name={user.name} size={28} />
            <Button variant="secondary" size="sm" onPress={onSignOut}>
              Sign out
            </Button>
          </>
        ) : null}
      </header>
      {user ? (
        <div className="py-2">
          {docs.map(([title, meta], i) => (
            <ListRow
              key={title}
              leading={<Icon name="doc" size={20} className="text-primary" />}
              title={title}
              subtitle={meta}
              divider={i < docs.length - 1}
            />
          ))}
        </div>
      ) : (
        <div
          role="group"
          aria-label="Your documents"
          aria-busy="true"
          className="grid gap-5 p-4"
        >
          {docs.map(([title]) => (
            <div key={title} className="flex items-center gap-3">
              <Skeleton shape="circle" className="size-9" />
              <div className="grid flex-1 gap-2">
                <Skeleton shape="text" className="w-1/2" />
                <Skeleton shape="text" className="w-1/3" />
              </div>
            </div>
          ))}
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
        compact ? 'h-[680px]' : 'h-[620px]',
      )}
    >
      {children}
    </div>
  )
}

// Any address signs in; registering taken@example.com shows the server's
// answer on the field. The variant picks the host: a desktop gets the
// dialog, a phone the tray.
export default function AuthGate({ variant = 'dialog' }: { variant?: string }) {
  const compact = variant === 'tray'
  return (
    <Window compact={compact}>
      <AtlasGate compact={compact} />
    </Window>
  )
}

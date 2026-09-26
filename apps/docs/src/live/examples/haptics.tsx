/* Haptics page examples. Each `// #region` is shown verbatim as the example's code. */
import { useEffect, useState } from 'react'
import {
  Button,
  FieldError,
  Haptics,
  HapticIndicator,
  Input,
  Label,
  List,
  ListRow,
  ListSection,
  Segmented,
  Slider,
  Switch,
  TextField,
  type HapticEvent,
} from '@brett_lamy/ui'
import raw from './haptics.tsx?raw'
import { Window, examples } from './chrome'

// #region haptics_verify
export function VerifyCode() {
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle')
  const verify = () => {
    const ok = code === '123456'
    // Outcomes get a notification: success, warning or error.
    Haptics.notification(ok ? 'success' : 'error')
    setState(ok ? 'ok' : 'bad')
  }
  return (
    <form
      style={{
        display: 'grid',
        gap: 12,
        maxWidth: 320,
        margin: '0 auto',
        padding: '8px 0',
      }}
      onSubmit={(e) => {
        e.preventDefault()
        verify()
      }}
    >
      <TextField
        value={code}
        onChange={(v) => {
          setCode(v)
          setState('idle')
        }}
        isInvalid={state === 'bad'}
      >
        <Label>Verification code</Label>
        <Input inputMode="numeric" placeholder="123456" maxLength={6} />
        <FieldError>That code didn’t match. Try 123456.</FieldError>
      </TextField>
      <Button type="submit" isDisabled={code.length < 6}>
        Verify
      </Button>
      {state === 'ok' && (
        <div style={{ textAlign: 'center', color: 'var(--bl-green)', fontWeight: 600 }}>
          Verified
        </div>
      )}
    </form>
  )
}
// #endregion

// #region haptics_log
export function HapticLog() {
  const [events, setEvents] = useState<HapticEvent[]>([])
  // Haptics.on observes every call (from your code and from the components).
  useEffect(() => Haptics.on((e) => setEvents((list) => [e, ...list].slice(0, 5))), [])
  return (
    <div
      style={{ position: 'relative', height: 300, padding: 16, boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button size="sm" variant="secondary" onPress={() => Haptics.impact('light')}>
          Light
        </Button>
        <Button size="sm" variant="secondary" onPress={() => Haptics.impact('heavy')}>
          Heavy
        </Button>
        <Button size="sm" variant="secondary" onPress={() => Haptics.selection()}>
          Selection
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => Haptics.notification('warning')}
        >
          Warning
        </Button>
      </div>
      <ol
        style={{
          margin: '14px 0 0',
          padding: 0,
          listStyle: 'none',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12.5,
        }}
      >
        {events.length ? (
          events.map((e, i) => (
            <li
              key={i}
              style={{
                padding: '6px 0',
                borderBottom: '1px solid var(--bl-sep)',
                opacity: 1 - i * 0.16,
              }}
            >
              {e.label} <span style={{ color: 'var(--bl-label3)' }}>· weight {e.w}</span>
            </li>
          ))
        ) : (
          <li style={{ color: 'var(--bl-label2)' }}>Press a button…</li>
        )}
      </ol>
      {/* The pill the Contacts demo shows: last event + active engine */}
      <HapticIndicator visible bottom={12} />
    </div>
  )
}
// #endregion

// #region haptics_builtin
export function BuiltInFeedback() {
  const [size, setSize] = useState('m')
  const [notify, setNotify] = useState(true)
  const [speed, setSpeed] = useState(3)
  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '10px 0' }}>
      {/* No haptics calls here: these components tick on their own */}
      <List inset>
        <ListSection title="Text size" footer="Segmented: one selection tick per change.">
          <div style={{ padding: 10, background: 'var(--bl-card)' }}>
            <Segmented
              aria-label="Text size"
              value={size}
              onChange={setSize}
              options={[
                { id: 's', label: 'Small' },
                { id: 'm', label: 'Medium' },
                { id: 'l', label: 'Large' },
              ]}
            />
          </div>
        </ListSection>
        <ListSection footer="Switch: a light impact. Slider: a tick at every step.">
          <ListRow
            title="Notifications"
            trailing={
              <Switch aria-label="Notifications" checked={notify} onChange={setNotify} />
            }
          />
          <div style={{ padding: '12px 16px', background: 'var(--bl-card)' }}>
            <Slider
              label="Playback speed"
              showValue
              minValue={1}
              maxValue={5}
              value={speed}
              onChange={setSpeed}
            />
          </div>
        </ListSection>
      </List>
    </div>
  )
}
// #endregion

export const HAPTICS_LIVE = examples(raw, [
  {
    id: 'haptics_verify',
    title: 'Success and error on submit',
    h: 220,
    Render: () => <VerifyCode />,
  },
  {
    id: 'haptics_log',
    title: 'Observe every event · Haptics.on',
    h: 320,
    Render: () => (
      <Window width={520}>
        <HapticLog />
      </Window>
    ),
  },
  {
    id: 'haptics_builtin',
    title: 'Controls that tick on their own',
    h: 470,
    Render: () => <BuiltInFeedback />,
  },
])

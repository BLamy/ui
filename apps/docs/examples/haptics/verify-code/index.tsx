import { useState } from 'react'
import {
  Button,
  FieldError,
  Haptics,
  Input,
  Label,
  TextField,
} from '@brett_lamy/ui'

export default function VerifyCode() {
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
        <div
          style={{
            textAlign: 'center',
            color: 'var(--success)',
            fontWeight: 600,
          }}
        >
          Verified
        </div>
      )}
    </form>
  )
}

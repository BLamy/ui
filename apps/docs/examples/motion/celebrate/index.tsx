import { useState } from 'react'
import {
  Button,
  Celebrate,
  Haptics,
  Icon,
  IconSwap,
  Spinner,
  TextMorph,
} from '@brett_lamy/ui'

// Rare moments may celebrate: the backup finishing is worth a burst. Tab
// switches are not.
export default function Backup() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [fired, setFired] = useState(0)
  const run = () => {
    setState('busy')
    setTimeout(() => {
      setState('done')
      setFired((n) => n + 1)
      Haptics.notification('success')
    }, 1400)
  }
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: 14,
        justifyItems: 'center',
        padding: '34px 0',
      }}
    >
      <span style={{ position: 'relative', isolation: 'isolate' }}>
        <Button
          size="lg"
          onPress={state === 'done' ? () => setState('idle') : run}
          isDisabled={state === 'busy'}
          className={state === 'done' ? 'bg-success' : undefined}
        >
          <IconSwap id={state}>
            {state === 'busy' ? (
              <Spinner spin size={18} />
            ) : (
              <Icon
                name={state === 'done' ? 'check' : 'layers'}
                size={18}
                sw={2.4}
              />
            )}
          </IconSwap>
          {/* A string sibling won't morph on its own — wrap it */}
          <TextMorph>
            {state === 'busy'
              ? 'Backing up…'
              : state === 'done'
                ? 'Backed up'
                : 'Back up wallet'}
          </TextMorph>
        </Button>
        <Celebrate fire={fired} />
      </span>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--muted-foreground)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {state === 'done'
          ? 'Press again to reset.'
          : 'Runs a pretend backup, then celebrates once.'}
      </div>
    </div>
  )
}

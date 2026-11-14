import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Celebrate } from '@/components/ui/celebrate'
import { Swap } from '@/components/ui/swap'
import { Spinner } from '@/components/ui/spinner'
import { TextMorph } from '@/components/ui/text-morph'
import { Icon } from '@/lib/icon'

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
      <Celebrate fire={fired}>
        <Button
          size="lg"
          onClick={state === 'done' ? () => setState('idle') : run}
          disabled={state === 'busy'}
          className={state === 'done' ? 'bg-success' : undefined}
        >
          <Swap effect="pop" value={state}>
            {state === 'busy' ? (
              <Spinner size={18} />
            ) : (
              <Icon
                name={state === 'done' ? 'check' : 'layers'}
                size={18}
                sw={2.4}
              />
            )}
          </Swap>
          {/* A string sibling won't morph on its own — wrap it */}
          <TextMorph>
            {state === 'busy'
              ? 'Backing up…'
              : state === 'done'
                ? 'Backed up'
                : 'Back up wallet'}
          </TextMorph>
        </Button>
      </Celebrate>
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

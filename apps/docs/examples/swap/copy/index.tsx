import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Swap } from '@/components/ui/swap'
import { Icon } from '@/lib/icon'

// effect="pop" stacks the old and new glyph in one grid cell: the old shrinks
// and blurs out while the new one grows in, and nothing beside it moves. Change
// `value` to swap; the button's accessible name changes with the state too.
export default function Copy() {
  const [copied, setCopied] = useState(false)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <div className="flex items-center justify-center gap-8">
      <Button
        variant="secondary"
        onClick={() => {
          void navigator.clipboard?.writeText('npx shadcn@latest add swap')
          setCopied(true)
        }}
      >
        <Swap effect="pop" value={copied ? 'check' : 'copy'}>
          <Icon name={copied ? 'check' : 'copy'} size={18} sw={2.2} />
        </Swap>
        {copied ? 'Copied' : 'Copy command'}
      </Button>
      <Button
        size="icon"
        variant="secondary"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => setPlaying((p) => !p)}
      >
        <Swap effect="pop" value={playing ? 'pause' : 'play'}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </Swap>
      </Button>
    </div>
  )
}

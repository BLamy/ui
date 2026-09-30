import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconSwap } from '@/components/ui/icon-swap'
import { Icon } from '@/lib/icon'

// IconSwap stacks the old and new glyph in one grid cell: the old shrinks and
// blurs out while the new one grows in, and nothing beside it moves. Change the
// `id` to swap; the button's accessible name changes with the state too.
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
        onPress={() => {
          void navigator.clipboard?.writeText('npx shadcn@latest add icon-swap')
          setCopied(true)
        }}
      >
        <IconSwap id={copied ? 'check' : 'copy'}>
          <Icon name={copied ? 'check' : 'copy'} size={18} sw={2.2} />
        </IconSwap>
        {copied ? 'Copied' : 'Copy command'}
      </Button>
      <Button
        size="icon"
        variant="secondary"
        aria-label={playing ? 'Pause' : 'Play'}
        onPress={() => setPlaying((p) => !p)}
      >
        <IconSwap id={playing ? 'pause' : 'play'}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </IconSwap>
      </Button>
    </div>
  )
}

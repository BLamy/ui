import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chevron, type ChevronDirection } from '@/components/ui/icon-swap'

const directions: ChevronDirection[] = ['right', 'down', 'left', 'up']

// One chevron that turns to face a new direction instead of swapping glyphs.
// It always takes the short way round, so `up` → `right` is a quarter turn.
export default function ChevronDemo() {
  const [open, setOpen] = useState(false)
  const [dir, setDir] = useState<ChevronDirection>('right')
  return (
    <div className="mx-auto grid max-w-sm justify-items-center gap-6">
      <Button
        variant="ghost"
        aria-expanded={open}
        onPress={() => setOpen((o) => !o)}
      >
        <Chevron direction={open ? 'down' : 'right'} size={16} />
        Advanced options
      </Button>
      <div className="flex items-center gap-3">
        <Chevron direction={dir} size={26} className="text-primary" />
        {directions.map((d) => (
          <Button
            key={d}
            size="sm"
            variant={d === dir ? 'default' : 'secondary'}
            onPress={() => setDir(d)}
          >
            {d}
          </Button>
        ))}
      </div>
    </div>
  )
}

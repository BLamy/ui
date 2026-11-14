import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Swap } from '@/components/ui/swap'
import { useDirection } from '@/lib/motion'

const titles = ['Sign in', 'Check your email', 'Choose a password']

// The title a dialog shows as it moves between views: a short travel (18px)
// and a stronger blur (6px) than a whole view's slide.
export default function Title() {
  const [view, setView] = useState(0)
  const dir = useDirection(view)
  return (
    <div className="mx-auto grid w-full max-w-sm justify-items-center gap-4">
      <h3 className="m-0 text-title font-semibold text-foreground">
        <Swap value={view} direction={dir} distance={18} blur={6} inline>{titles[view]}</Swap>
      </h3>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={view === 0} onClick={() => setView(view - 1)}>Back</Button>
        <Button disabled={view === titles.length - 1} onClick={() => setView(view + 1)}>Next</Button>
      </div>
    </div>
  )
}

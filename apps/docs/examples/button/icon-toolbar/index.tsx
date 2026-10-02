import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icon'
import { Separator } from '@/components/ui/separator'

// A toolbar tool is a `quiet` Button with `size="icon-sm"`: muted until hovered, filled while `active`. The
// wrapper below is yours to write if you press the same shape often; `active` is yours to own, so pass the same
// flag to the next control (here the status line) to keep them in step.
function Tool({ icon, label, glyph = 18, ...props }: { icon: string; label: string; glyph?: number } & Omit<ComponentProps<typeof Button>, 'children'>) {
  return (
    <Button variant="quiet" size="icon-sm" aria-label={label} title={label} {...props}>
      <Icon name={icon} size={glyph} sw={1.7} />
    </Button>
  )
}

export default function IconToolbar() {
  const [starred, setStarred] = useState(false)
  const [saved, setSaved] = useState(true)
  const [log, setLog] = useState('Nothing copied yet')

  return (
    <div className="mx-auto grid max-w-md gap-3">
      <div className="flex h-toolbar items-center gap-1 rounded-card bg-card px-3 shadow-hairline">
        <Tool icon="pencil" label="Edit" onPress={() => setLog('Edit')} />
        <Tool icon="copy" label="Copy link" onPress={() => setLog('Link copied')} />
        <Tool icon="share" label="Share" onPress={() => setLog('Share sheet opened')} />
        <Separator orientation="vertical" className="mx-1 my-3" />
        <Tool
          icon={starred ? 'star-fill' : 'star'}
          label={starred ? 'Remove star' : 'Star'}
          active={starred}
          onPress={() => setStarred((v) => !v)}
        />
        <Tool icon="bookmark" label="Bookmark" active={saved} onPress={() => setSaved((v) => !v)} />
        <span className="flex-1" />
        <Tool icon="trash" label="Delete" glyph={20} onPress={() => setLog('Deleted')} />
      </div>
      <p className="m-0 px-1 text-footnote text-foreground" aria-live="polite">
        {log} · {starred ? 'starred' : 'not starred'} · {saved ? 'bookmarked' : 'not bookmarked'}
      </p>
    </div>
  )
}

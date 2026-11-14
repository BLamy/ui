import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Icon } from '@/lib/icon'
import { Separator } from '@/components/ui/separator'

// A toolbar has two kinds of tool. An action is a `quiet` Button with `size="icon-sm"`: muted until hovered. A tool
// that stays on is a `quiet` Toggle of the same size: the same look, filled while pressed, and `aria-pressed` tells a
// screen reader whether it is on. Keep its label the same in both states; the pressed state carries the change.
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
      <div role="toolbar" aria-label="Note" className="flex h-toolbar items-center gap-1 rounded-card bg-card px-3 shadow-hairline">
        <Tool icon="pencil" label="Edit" onClick={() => setLog('Edit')} />
        <Tool icon="copy" label="Copy link" onClick={() => setLog('Link copied')} />
        <Tool icon="share" label="Share" onClick={() => setLog('Share sheet opened')} />
        <Separator orientation="vertical" className="mx-1 my-3" />
        <Toggle variant="quiet" size="icon-sm" aria-label="Star" title="Star" pressed={starred} onPressedChange={setStarred}>
          <Icon name={starred ? 'star-fill' : 'star'} size={18} sw={1.7} />
        </Toggle>
        <Toggle variant="quiet" size="icon-sm" aria-label="Bookmark" title="Bookmark" pressed={saved} onPressedChange={setSaved}>
          <Icon name="bookmark" size={18} sw={1.7} />
        </Toggle>
        <span className="flex-1" />
        <Tool icon="trash" label="Delete" glyph={20} onClick={() => setLog('Deleted')} />
      </div>
      <p className="m-0 px-1 text-footnote text-foreground" aria-live="polite">
        {log} · {starred ? 'starred' : 'not starred'} · {saved ? 'bookmarked' : 'not bookmarked'}
      </p>
    </div>
  )
}

import { useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { Separator } from '@/components/ui/separator'

// `active` is yours to own: IconButton only draws the filled state. Pass the
// same flag to the next control (here the status line) to keep them in step.
export default function Toolbar() {
  const [starred, setStarred] = useState(false)
  const [saved, setSaved] = useState(true)
  const [log, setLog] = useState('Nothing copied yet')

  return (
    <div className="mx-auto grid max-w-md gap-3">
      <div className="flex h-toolbar items-center gap-1 rounded-card bg-card px-3 shadow-hairline">
        <IconButton name="pencil" label="Edit" onPress={() => setLog('Edit')} />
        <IconButton name="copy" label="Copy link" onPress={() => setLog('Link copied')} />
        <IconButton name="share" label="Share" onPress={() => setLog('Share sheet opened')} />
        <Separator orientation="vertical" className="mx-1 my-3" />
        <IconButton
          name={starred ? 'star-fill' : 'star'}
          label={starred ? 'Remove star' : 'Star'}
          active={starred}
          onPress={() => setStarred((v) => !v)}
        />
        <IconButton name="bookmark" label="Bookmark" active={saved} onPress={() => setSaved((v) => !v)} />
        <span className="flex-1" />
        <IconButton name="trash" label="Delete" size={20} onPress={() => setLog('Deleted')} />
      </div>
      <p className="m-0 px-1 text-footnote text-muted-foreground" aria-live="polite">
        {log} · {starred ? 'starred' : 'not starred'} · {saved ? 'bookmarked' : 'not bookmarked'}
      </p>
    </div>
  )
}

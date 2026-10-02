import { useState } from 'react'
import { useKeyboard } from 'react-aria'

// useKeyboard's `shortcuts` map: "Mod" is Command on Apple platforms and Ctrl
// elsewhere. A handler that returns nothing counts as handled (the browser
// default is prevented and the event stops here); returning false lets the key
// carry on. Keys that match no shortcut always carry on, which the parent <div>
// proves: it only hears the keys useKeyboard did not take.
export default function Shortcuts() {
  const [text, setText] = useState('Edit me, then press Mod+S.')
  const [saved, setSaved] = useState<string | null>(null)
  const [handled, setHandled] = useState('none yet')
  const [bubbled, setBubbled] = useState('none yet')

  const { keyboardProps } = useKeyboard({
    shortcuts: {
      'Mod+s': () => {
        setSaved(text)
        setHandled('Mod+S saved the note')
      },
      'Mod+Shift+k': () => {
        setText('')
        setHandled('Mod+Shift+K cleared the note')
      },
      Escape: () => {
        if (text === '') return false // nothing to revert: let the key through
        setText(saved ?? '')
        setHandled('Escape reverted to the last save')
        return true // handled: preventDefault, and the key stops here
      },
    },
  })

  return (
    <div
      className="mx-auto grid w-full max-w-md gap-3"
      onKeyDown={(e) => !['Meta', 'Control', 'Shift', 'Alt'].includes(e.key) && setBubbled(`${e.metaKey ? 'Meta+' : ''}${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`)}
    >
      <label className="grid gap-1.5 text-footnote text-foreground">
        Note
        <textarea
          {...keyboardProps}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="box-border w-full resize-none rounded-ctl border-0 bg-card p-3 text-body text-foreground shadow-hairline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
        />
      </label>
      <dl className="m-0 grid gap-2 text-footnote">
        <div className="flex justify-between gap-3">
          <dt className="text-foreground">Last save</dt>
          <dd className="m-0 truncate text-foreground">{saved ?? 'nothing saved'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-foreground">Handled by useKeyboard</dt>
          <dd className="m-0 text-foreground">{handled}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-foreground">Reached the parent</dt>
          <dd className="m-0 font-mono text-foreground">{bubbled}</dd>
        </div>
      </dl>
      <p className="m-0 text-footnote text-foreground">
        Mod+S saves, Mod+Shift+K clears, Escape reverts to the last save.
      </p>
    </div>
  )
}

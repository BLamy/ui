import { useState } from 'react'
import {
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandMenu,
  useCommandActive,
} from '@brett_lamy/ui'

const smileys: [string, string][] = [
  ['😀', 'grinning'], ['😂', 'joy'], ['🥹', 'holding back tears'], ['😍', 'heart eyes'], ['🤔', 'thinking'],
  ['😎', 'sunglasses cool'], ['🥳', 'party'], ['😴', 'sleeping'], ['🙃', 'upside down'], ['😬', 'grimacing'],
  ['🤯', 'mind blown'], ['🫠', 'melting'], ['😇', 'halo innocent'], ['🤓', 'nerd'],
]
const gestures: [string, string][] = [
  ['👍', 'thumbs up'], ['👏', 'clap'], ['🙏', 'pray thanks'], ['👋', 'wave hello'], ['🤝', 'handshake'],
  ['✌️', 'victory peace'], ['🫶', 'heart hands'], ['💪', 'strong flex'], ['🔥', 'fire'], ['✨', 'sparkles'],
  ['🎉', 'tada party'], ['❤️', 'heart love'], ['💯', 'hundred'], ['🚀', 'rocket ship'],
]

/** The footer reads the active cell: useCommandActive() is the active item's value. */
function ActiveName() {
  const value = useCommandActive()
  const name = value?.split(' ').slice(1).join(' ')
  return <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{name ? `:${name.replace(/ /g, '_')}:` : ''}</span>
}

export default function EmojiGrid() {
  const [picked, setPicked] = useState<string[]>([])
  const cell = ([e, name]: [string, string]) => (
    <CommandItem key={e} value={`${e} ${name}`} onSelect={() => setPicked((p) => [e, ...p].slice(0, 12))}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>{e}</span>
    </CommandItem>
  )
  return (
    <div style={{ display: 'grid', gap: 12, width: 'min(460px, 100%)' }}>
      <CommandMenu aria-label="Emoji">
        <CommandInput placeholder="Search emoji…" />
        <CommandList maxHeight={280}>
          <CommandEmpty>No emoji found</CommandEmpty>
          {/* columns: ← → move within the grid, ↑ ↓ move a row and leave it at the edges */}
          <CommandGroup heading="Smileys" columns={7}>{smileys.map(cell)}</CommandGroup>
          <CommandGroup heading="Gestures & symbols" columns={7}>{gestures.map(cell)}</CommandGroup>
        </CommandList>
        <CommandFooter legend={[{ keys: ['←', '→', '↑', '↓'], label: 'Move' }, { keys: ['Enter'], label: 'Pick' }]}>
          <ActiveName />
        </CommandFooter>
      </CommandMenu>
      <div style={{ minHeight: 28, fontSize: 22, letterSpacing: 4 }}>{picked.join('')}</div>
    </div>
  )
}

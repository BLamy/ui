import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Composer, ComposerAddon, ComposerCard, ComposerInput, ComposerSelect, ComposerSend } from '@/components/ui/composer/composer'
import { ThemeScope } from '@/lib/theme'
import { Icon } from '@/lib/icon'

const tones = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'concise', label: 'Concise' },
]

/**
 * Replies for a few seconds after each send, so the send ↔ stop morph can be
 * seen.
 */
function useFakeReply(ms = 2200) {
  const [streaming, setStreaming] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (t.current) clearTimeout(t.current)
    },
    [],
  )
  return {
    streaming,
    onSubmit: () => {
      setStreaming(true)
      if (t.current) clearTimeout(t.current)
      t.current = setTimeout(() => setStreaming(false), ms)
    },
    onStop: () => {
      if (t.current) clearTimeout(t.current)
      setStreaming(false)
    },
  }
}

// A one-row messenger: a "+" column before the editor (inline-start), a tone
// picker and send after it (inline-end). Addons order themselves, so the markup
// order doesn't matter.
function Messenger() {
  const reply = useFakeReply(1800)
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '36px 0' }}>
      <Composer
        onSubmit={reply.onSubmit}
        streaming={reply.streaming}
        onStop={reply.onStop}
      >
        <ComposerCard size="lg" className="flex-nowrap">
          <ComposerAddon align="inline-start" className="self-center pt-0 pl-2">
            <Button variant="quiet" size="icon-sm" aria-label="Add" className="rounded-full">
              <Icon name="plus" size={16} sw={2.2} />
            </Button>
          </ComposerAddon>
          <ComposerInput placeholder="Reply to #design" slashMenu={false} />
          <ComposerAddon align="inline-end" className="self-center pt-0 pr-2">
            <ComposerSelect aria-label="Tone" items={tones} />
            <ComposerSend stopVariant="solid" />
          </ComposerAddon>
        </ComposerCard>
      </Composer>
    </div>
  )
}

// A `workbench` ThemeScope follows the app's light / dark appearance.
export default function MessengerExample() {
  return (
    <ThemeScope scope="workbench" style={{ padding: 18 }}>
      <Messenger />
    </ThemeScope>
  )
}

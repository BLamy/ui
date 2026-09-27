import { useEffect, useRef, useState } from 'react'
import {
  Composer,
  ComposerAddon,
  ComposerButton,
  ComposerCard,
  ComposerInput,
  ComposerSelect,
  ComposerSend,
  WIcon,
  WorkbenchTheme,
} from '@brett_lamy/ui'

const tones = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'concise', label: 'Concise' },
]

/** Replies for a few seconds after each send, so the send ↔ stop morph can be seen. */
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

// A one-row messenger: a "+" column before the editor (inline-start), a tone picker and send after
// it (inline-end). Addons order themselves, so the markup order doesn't matter.
function Messenger() {
  const reply = useFakeReply(1800)
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '36px 0' }}>
      <Composer onSubmit={reply.onSubmit} streaming={reply.streaming} onStop={reply.onStop}>
        <ComposerCard size="lg" className="flex-nowrap">
          <ComposerAddon align="inline-start" className="self-center pt-0 pl-2">
            <ComposerButton aria-label="Add" className="rounded-[50%]">
              <WIcon name="plus" size={16} sw={2.2} />
            </ComposerButton>
          </ComposerAddon>
          <ComposerInput placeholder="Reply to #design" slashMenu={false} />
          <ComposerAddon align="inline-end" className="self-center pt-0 pr-2">
            <ComposerSelect aria-label="Tone" options={tones} />
            <ComposerSend stopVariant="solid" />
          </ComposerAddon>
        </ComposerCard>
      </Composer>
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the app's light / dark appearance.
export default function MessengerExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Messenger />
    </WorkbenchTheme>
  )
}

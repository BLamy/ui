import { useEffect, useRef, useState } from 'react'
import {
  Composer,
  ComposerCard,
  ComposerFooter,
  ComposerInput,
  ComposerSend,
  ComposerSpacer,
  WorkbenchTheme,
} from '@brett_lamy/ui'

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

// The smallest composer: a card, the editor and a send button. While
// `streaming`, the send button morphs into the stop control — the same button,
// its fill and glyph changing.
function Minimal() {
  const reply = useFakeReply()
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 0' }}>
      <Composer
        onSubmit={reply.onSubmit}
        streaming={reply.streaming}
        onStop={reply.onStop}
      >
        <ComposerCard>
          <ComposerInput
            placeholder={'Message — press Enter to watch send turn into stop'}
          />
          <ComposerFooter>
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the
// app's light / dark appearance.
export default function MinimalExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Minimal />
    </WorkbenchTheme>
  )
}

/* WorkbenchShell page — the thread's first message (the centred composer travels down to its dock as the
   same element), and the compact terminal sheet (SnapSheet) with snap points and velocity release. */
import { useRef, useState } from 'react';
import { ChatView, SnapSheet, TermBody, TermHeader, TERM_SEED, WorkbenchTheme, type WorkbenchThread } from '@brett_lamy/workbench';
import { useAppearance } from '@brett_lamy/ui';
import type { LiveSpec } from '../frame';

const firstMessageCode = `import { useState } from 'react'
import { ChatView, type WorkbenchThread } from '@brett_lamy/ui'

// With no thread, ChatView is the empty state: a greeting, the composer centred, suggestions.
// Send the first message and it becomes the thread around the same composer — the greeting leaves,
// the composer travels down to its dock (draft, focus and all), and the first turn rises in.
export default function NewThread() {
  const [thread, setThread] = useState<WorkbenchThread | null>(null)
  const send = (text: string) => setThread(startThread(text))
  return <ChatView thread={thread} onSend={send} />
}`;

const sheetCode = `import { useState } from 'react'
import { SnapSheet, TermHeader, TermBody } from '@brett_lamy/ui'

// The compact terminal: a vaul-style sheet. It rises on a spring, follows the finger one-to-one
// (rubber-banding past the top), and on release its velocity picks a snap — or dismisses it.
export default function Terminal() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Terminal</button>
      <SnapSheet open={open} onClose={() => setOpen(false)} snaps={[0.5, 0.92]}>
        <TermHeader title="zsh — cookbook" />
        <TermBody seed={lines} />
      </SnapSheet>
    </>
  )
}`;

function reply(text: string): string {
  return `Here’s the plan for **${text.replace(/\.$/, '')}**:\n\n1. Read the relevant files\n2. Make the change\n3. Run the checks and report back`;
}

export const WORKBENCH_SHELL_EXAMPLES: Record<string, LiveSpec> = {
  workbench_first_message: {
    title: 'ChatView · the first message', theme: 'wb', h: 520,
    code: firstMessageCode,
    Render: function FirstMessageLive() {
      const [thread, setThread] = useState<WorkbenchThread | null>(null);
      const [streaming, setStreaming] = useState(false);
      const t = useRef<ReturnType<typeof setTimeout> | null>(null);
      const send = (text: string) => {
        const id = 'm' + Date.now();
        const msgs = [...(thread?.msgs ?? []), { id: id + 'u', role: 'user' as const, md: text }, { id: id + 'a', role: 'assistant' as const, md: '', live: true }];
        setThread({ id: thread?.id ?? 'docs', title: text, age: 'now', settled: false, msgs });
        setStreaming(true);
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => {
          setThread((th) => th && { ...th, msgs: th.msgs.map((m) => (m.id === id + 'a' ? { ...m, md: reply(text), live: false } : m)) });
          setStreaming(false);
        }, 1400);
      };
      return (
        <div>
          <div style={{ height: 460, display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)', background: 'var(--wb-bg)' }}>
            <ChatView thread={thread} streaming={streaming} onSend={send} onStop={() => setStreaming(false)} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button type="button" onClick={() => setThread(null)} style={{ border: 0, background: 'none', color: 'var(--wb-tint)', font: 'inherit', fontSize: 12, cursor: 'pointer' }}>
              Start over
            </button>
          </div>
        </div>
      );
    },
  },
  workbench_snapsheet: {
    title: 'SnapSheet · the compact terminal', theme: 'wb', h: 480,
    code: sheetCode,
    Render: function SnapSheetLive() {
      const [open, setOpen] = useState(false);
      const light = useAppearance() === 'light';
      return (
        <WorkbenchTheme style={{ position: 'relative', width: 390, maxWidth: '100%', height: 460, margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)' }}>
          <div style={{ padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>cookbook · main</div>
            <div style={{ fontSize: 13, color: 'var(--wb-label2)', lineHeight: 1.5 }}>
              Open the terminal, then drag its handle: a slow drag settles at the nearest snap, a flick carries on to the next — or down past the lowest to close.
            </div>
            <button
              type="button"
              className="wb-btn"
              onClick={() => setOpen(true)}
              style={{ justifySelf: 'start', border: 0, borderRadius: 9, background: 'var(--wb-tint)', color: '#fff', font: 'inherit', fontWeight: 600, fontSize: 13, padding: '8px 14px', cursor: 'pointer' }}
            >
              Open terminal
            </button>
          </div>
          <SnapSheet open={open} onClose={() => setOpen(false)} snaps={[0.5, 0.92]} bg={light ? '#1C1C23' : undefined}>
            <div className="wb-term flex min-h-0 flex-1 flex-col" style={{ colorScheme: 'dark' }}>
              <TermHeader title="zsh — cookbook" />
              <TermBody seed={TERM_SEED} />
            </div>
          </SnapSheet>
        </WorkbenchTheme>
      );
    },
  },
};

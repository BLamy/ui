import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  Composer,
  ComposerAttach,
  ComposerAttachments,
  ComposerBump,
  ComposerBumpContent,
  ComposerBumpHandle,
  ComposerCard,
  ComposerExpand,
  ComposerFooter,
  ComposerInput,
  ComposerOptions,
  ComposerOptionsOutlet,
  ComposerSelect,
  ComposerSend,
  ComposerSeparator,
  ComposerSpacer,
  ComposerStop,
  ComposerText,
  ModelPicker,
  WORKBENCH_MODELS,
  WORKBENCH_PROVIDERS,
  WorkbenchTheme,
} from '@brett_lamy/ui'

const efforts = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]
const access = [
  { id: 'full', label: 'Full access' },
  { id: 'read', label: 'Read only' },
]

/* A chat transcript for the scroll-linked composer: it opens at the newest
   message (the bottom). */
const thread: [who: 'me' | 'agent', text: string][] = [
  ['me', 'Morning! Can you look at the shell layout before the release?'],
  [
    'agent',
    'Sure. I opened the shell at 1400, 1024 and 390 px and read through the ' +
      'layout code first.',
  ],
  [
    'agent',
    'Two things stand out: the sidebar drawer and the sticky header compete ' +
      'on z-index, and the scrim lives inside the main column.',
  ],
  ['me', 'Which one bites first?'],
  [
    'agent',
    'The z-index one. At 390 px the header paints over the open drawer’s ' +
      'first row.',
  ],
  ['me', 'The header has a backdrop-filter.'],
  [
    'agent',
    'That’s it: backdrop-filter makes a stacking context, so the drawer is ' +
      'compared against the header’s parent. Portaling the drawer into the ' +
      'shell fixes it.',
  ],
  ['me', 'Do that, and keep the scrim under the header.'],
  [
    'agent',
    'Done — the drawer portals into the shell and the scrim sits at 25. ' +
      'Storybook and the docs both look right.',
  ],
  ['me', 'Check the light appearance too?'],
  [
    'agent',
    'Same result in light; the scrim is a touch lighter there, matching the ' +
      'system sheets.',
  ],
  ['me', 'Ship it.'],
  [
    'agent',
    'Committed as “fix(shell): drawer above sticky header”. Scroll up to ' +
      'read back — the composer folds out of the way.',
  ],
]

function Transcript({
  scroller,
}: {
  scroller: RefObject<HTMLDivElement | null>
}) {
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [scroller])
  return (
    <div
      ref={scroller}
      className="wb-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: '20px 20px 190px',
      }}
    >
      <div
        style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gap: 10 }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--wb-label3)',
            textAlign: 'center',
            padding: '2px 0 6px',
          }}
        >
          Thread · Fix the header overlap
        </div>
        {thread.map(([who, text], i) =>
          who === 'me' ? (
            <div
              key={i}
              style={{ display: 'flex', justifyContent: 'flex-end' }}
            >
              <div
                style={{
                  maxWidth: '78%',
                  padding: '8px 12px',
                  borderRadius: '14px 14px 4px 14px',
                  background: 'var(--wb-fill2)',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                {text}
              </div>
            </div>
          ) : (
            <div
              key={i}
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: 'var(--wb-label)',
                padding: '2px 2px 4px',
              }}
            >
              {text}
            </div>
          ),
        )}
      </div>
    </div>
  )
}

// Options live in the footer; when the composer is compact they move into the
// bottom bump's outlet. Scroll → FAB (collapseOnScroll): the transcript opens
// at its newest message; scrolling up folds the composer to one row, a flick or
// a long read folds it into a FAB; scrolling back down — or tapping the FAB —
// restores it.
function CompositionalParts({ variant = 'full' }: { variant?: string }) {
  const [streaming, setStreaming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const full = variant === 'full'

  const composer = (
    <Composer
      key={variant}
      defaultValue={
        full ? '## Ship checklist\n\n- Highlight code\n- Publish package' : ''
      }
      defaultCollapsed={variant === 'compact' ? 'compact' : undefined}
      collapseOnScroll={variant === 'scroll' ? scroller : undefined}
      collapseTo="fab"
      onSubmit={() => {
        setStreaming(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setStreaming(false), 1600)
      }}
      streaming={streaming}
      onStop={() => {
        clearTimeout(timer.current)
        setStreaming(false)
      }}
    >
      {full ? (
        <ComposerBump side="top" draggable maxReveal={160}>
          <ComposerBumpContent label="Dev server log">
            <div
              style={{
                padding: '10px 14px',
                fontFamily: 'ui-monospace,Menlo,monospace',
                fontSize: 11.5,
                lineHeight: 1.6,
                opacity: 0.8,
              }}
            >
              <div>✓ ready in 412 ms</div>
              <div>✓ 287 stories indexed</div>
              <div>→ composer.tsx changed, HMR update</div>
            </div>
          </ComposerBumpContent>
          <ComposerBumpHandle>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: 'var(--wb-green)',
              }}
            />
            <ComposerText className="flex-1">
              Monitoring · pnpm dev
            </ComposerText>
          </ComposerBumpHandle>
        </ComposerBump>
      ) : null}
      <ComposerCard size="lg">
        {full ? <ComposerExpand /> : null}
        <ComposerAttachments />
        <ComposerInput placeholder="Ask anything, paste an image" />
        <ComposerFooter>
          <ComposerOptions>
            <ModelPicker
              models={WORKBENCH_MODELS}
              providers={WORKBENCH_PROVIDERS}
              defaultValue="claude-opus-5-5"
            />
            <ComposerSeparator />
            <ComposerSelect
              aria-label="Effort"
              options={efforts}
              defaultValue="medium"
            />
            <ComposerSeparator />
            <ComposerSelect aria-label="Access" icon="lock" options={access} />
          </ComposerOptions>
          <ComposerSpacer />
          <ComposerAttach />
          <ComposerStop variant="solid" />
          <ComposerSend morph={false} />
        </ComposerFooter>
      </ComposerCard>
      <ComposerBump side="bottom">
        <ComposerBumpHandle>
          <ComposerText icon="folder" className="shrink-0">
            Local checkout
          </ComposerText>
          <ComposerOptionsOutlet />
          <ComposerSpacer />
          <ComposerText icon="branch">main</ComposerText>
        </ComposerBumpHandle>
      </ComposerBump>
    </Composer>
  )

  if (variant !== 'scroll') {
    return (
      <div
        style={{
          maxWidth: variant === 'compact' ? 720 : 580,
          margin: '0 auto',
          paddingTop: full ? 24 : 120,
        }}
      >
        {composer}
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', height: 420, margin: '-16px' }}>
      <Transcript scroller={scroller} />
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 14 }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>{composer}</div>
      </div>
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the
// app's light / dark appearance.
export default function CompositionalPartsExample({
  variant,
}: {
  variant?: string
}) {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <CompositionalParts variant={variant} />
    </WorkbenchTheme>
  )
}

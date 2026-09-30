import { Composer, ComposerAttach, ComposerAttachments, ComposerCard, ComposerExpand, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, WorkbenchTheme } from '@brett_lamy/ui'
import { type ComposerAttachment } from '@/components/blocks/t3-clone/components/workbench/workbench-composer'

// A stand-in "pasted screenshot" so the example has an image to start with.
const shot =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340"><rect ' +
      'width="560" height="340" fill="#1C1C23"/><rect x="24" y="24" ' +
      'width="512" height="60" rx="10" fill="#26262E"/><rect x="24" y="104" ' +
      'width="330" height="212" rx="10" fill="#101015"/><rect x="374" ' +
      'y="104" width="162" height="212" rx="10" fill="#0A84FF"/><text x="44" ' +
      'y="60" fill="#9C9CA6" font-family="ui-monospace,Menlo,monospace" ' +
      'font-size="15">pasted screenshot</text></svg>',
  )

const seed: ComposerAttachment[] = [
  {
    id: 'shot-1',
    name: 'header.png',
    src: shot,
    size: 84 * 1024,
    type: 'image/svg+xml',
  },
]

// Paste or attach an image: a chip lands at the caret and a thumbnail pops into
// the strip. Press either — the PencilKit annotator (the default) zooms out of
// it; Save flattens the strokes and lands back in it. (Swap it with <Composer
// annotator={MyAnnotator}> or a <ComposerAnnotatorProvider>; annotator={null}
// opts out.)
function ImageChips() {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 0' }}>
      <Composer
        defaultAttachments={seed}
        defaultValue={
          'The header overlaps the sidebar here ' +
          '![header.png](attachment:shot-1) — can you fix the z-index?'
        }
      >
        <ComposerCard>
          <ComposerExpand />
          <ComposerAttachments />
          <ComposerInput placeholder="Paste an image" />
          <ComposerFooter>
            <ComposerAttach />
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
      <p
        style={{
          fontSize: 12,
          color: 'var(--muted-foreground)',
          textAlign: 'center',
          margin: '12px 0 0',
        }}
      >
        Press the thumbnail or the chip: the image zooms out of it. ✕ removes it
        — its neighbours slide over and the strip folds away.
      </p>
    </div>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function ImageChipsExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <ImageChips />
    </WorkbenchTheme>
  )
}

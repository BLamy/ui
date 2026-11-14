import { ObjectValue } from '@/components/ui/object-value'
import { previewFromValue } from '@/lib/object-tree-value'

const NOTE = 'The quick brown fox jumps over the lazy dog, and keeps on going past the barn, over the hill and down to the sea.'

// A console prints a top-level string bare (`quote={false}`) and everything else as a preview. In a row of fixed
// height, `actions={false}` keeps the value on one line, cut at `maxLength`, with no buttons.
export default function Console() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-card bg-card p-3 shadow-hairline">
        <div className="text-caption"><span className="me-2 text-muted-foreground">›</span><ObjectValue value={{ type: 'string', value: 'Saved 3 items' }} quote={false} /></div>
        <div className="text-caption"><span className="me-2 text-muted-foreground">›</span><ObjectValue value={previewFromValue({ id: 'c_81f2', items: [1, 2, 3], total: 148.5 })} /></div>
      </div>
      <div className="flex flex-col rounded-card bg-card p-1 shadow-hairline">
        {[['note', { type: 'string' as const, value: NOTE }], ['cart', previewFromValue({ items: [1, 2, 3], total: 42.5 })]].map(([name, value]) => (
          <div key={name as string} className="flex h-6 items-center gap-1 px-2 font-mono text-caption">
            <span className="shrink-0 text-muted-foreground">{name as string}:</span>
            <ObjectValue value={value as never} actions={false} maxLength={60} className="min-w-0 flex-1 truncate whitespace-pre" />
          </div>
        ))}
      </div>
    </div>
  )
}

import { Skeleton, SkeletonText } from '@/components/ui/skeleton'

// A card placeholder: a `rect` for the artwork (media keeps square-ish
// corners), text lines for the title and blurb, a `rounded` block for the
// button.
function CardPlaceholder() {
  return (
    <div
      style={{
        overflow: 'hidden',
        borderRadius: 16,
        background: 'var(--card)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <Skeleton shape="rect" style={{ aspectRatio: '16 / 9', width: '100%' }} />
      <div style={{ display: 'grid', gap: 12, padding: 14 }}>
        <Skeleton shape="text" height={16} width="70%" />
        <SkeletonText lines={2} lastLineWidth="45%" lineHeight={12} />
        <Skeleton shape="rounded" height={34} width={112} />
      </div>
    </div>
  )
}

export default function MediaCard() {
  return (
    <div
      role="group"
      aria-busy="true"
      aria-label="Loading episodes"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 14,
        maxWidth: 620,
        margin: '0 auto',
      }}
    >
      <CardPlaceholder />
      <CardPlaceholder />
      <CardPlaceholder />
    </div>
  )
}

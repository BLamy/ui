import { Skeleton, SkeletonText } from '@/components/ui/skeleton'

// SkeletonText stacks `lines` text bars and shortens the last one, so the
// block reads as a paragraph. Size the headline with a taller text line.
export default function Paragraph() {
  return (
    <article
      role="group"
      aria-busy="true"
      aria-label="Loading article"
      style={{
        display: 'grid',
        gap: 14,
        maxWidth: 520,
        margin: '0 auto',
        padding: 20,
        borderRadius: 16,
        background: 'var(--card)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <Skeleton shape="text" height={12} width={90} />
      <Skeleton shape="text" height={24} width="80%" />
      <SkeletonText lines={4} />
      <SkeletonText lines={3} lastLineWidth="35%" />
    </article>
  )
}

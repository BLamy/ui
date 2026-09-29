import { Skeleton, SkeletonText } from '@brett_lamy/ui'

// Profile headers at three sizes: a `circle` for the avatar beside a name and
// a handle, then a short bio.
const sizes = [
  { avatar: 32, name: 110 },
  { avatar: 48, name: 150 },
  { avatar: 64, name: 180 },
]

export default function AvatarText() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading profiles"
      style={{
        display: 'grid',
        gap: 22,
        maxWidth: 420,
        margin: '0 auto',
        padding: 20,
        borderRadius: 16,
        background: 'var(--card)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      {sizes.map((s) => (
        <div key={s.avatar} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton shape="circle" width={s.avatar} height={s.avatar} />
            <div style={{ display: 'grid', gap: 7, flex: 1 }}>
              <Skeleton shape="text" width={s.name} />
              <Skeleton shape="text" height={12} width={s.name * 0.55} />
            </div>
          </div>
          {s.avatar === 64 ? (
            <SkeletonText lines={2} lastLineWidth="70%" lineHeight={12} />
          ) : null}
        </div>
      ))}
    </div>
  )
}

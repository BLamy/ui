import { BLProvider, Skeleton, SkeletonText } from '@brett_lamy/ui'

// The fill and the sweep are drawn from the --bl-* tokens (fill2 under a
// card-coloured highlight), so the same placeholder sits right on light and
// dark surfaces with no extra props.
function Sample() {
  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        padding: 16,
        borderRadius: 14,
        background: 'var(--card)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Skeleton shape="circle" width={36} height={36} />
        <div style={{ display: 'grid', gap: 6, flex: 1 }}>
          <Skeleton shape="text" width="60%" />
          <Skeleton shape="text" height={12} width="35%" />
        </div>
      </div>
      <Skeleton shape="rect" height={96} />
      <SkeletonText lines={2} lineHeight={12} />
    </div>
  )
}

export default function LightAndDark() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      {[false, true].map((dark) => (
        <BLProvider
          key={String(dark)}
          dark={dark}
          style={{ height: 'auto', padding: 14, borderRadius: 16 }}
        >
          <div
            style={{
              marginBottom: 10,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              color: 'var(--muted-foreground)',
            }}
          >
            {dark ? 'Dark' : 'Light'}
          </div>
          <Sample />
        </BLProvider>
      ))}
    </div>
  )
}

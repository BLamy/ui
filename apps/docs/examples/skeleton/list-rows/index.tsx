import { List, ListRow, ListSection, Skeleton } from '@brett_lamy/ui'

// Real ListRows with placeholders in their slots: the rows keep their height,
// insets and dividers, so nothing jumps when the names arrive.
export default function ListRows() {
  const widths = [132, 168, 104, 150]
  return (
    <div
      aria-busy="true"
      aria-label="Loading contacts"
      style={{
        maxWidth: 420,
        margin: '0 auto',
        padding: '4px 0',
        borderRadius: 14,
        background: 'var(--bl-bg2)',
        boxShadow: '0 0 0 1px var(--bl-sep)',
      }}
    >
      <List inset>
        <ListSection title="Recents">
          {widths.map((w, i) => (
            <ListRow
              key={i}
              leading={<Skeleton shape="circle" width={40} height={40} />}
              title={<Skeleton shape="text" width={w} />}
              subtitle={
                <Skeleton
                  shape="text"
                  width={w * 0.6}
                  height={12}
                  style={{ marginTop: 6 }}
                />
              }
              accessory="chevron"
              divider={i < widths.length - 1}
            />
          ))}
        </ListSection>
      </List>
    </div>
  )
}

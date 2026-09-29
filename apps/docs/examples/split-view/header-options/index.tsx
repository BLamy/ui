import {
  SplitView,
  SplitViewContent,
  SplitViewDetail,
  SplitViewHeader,
  SplitViewItem,
  SplitViewSection,
  SplitViewSidebar,
} from '@brett_lamy/ui'

const reminders = [
  'Book the cabin ferry',
  'Call Mom back',
  'Review SplitView PR',
  'Water the ferns',
]

/**
 * - The sidebar bar shows "Lists" only once the list scrolls (`titleOnScroll`).
 * - "My Lists" is a `prominent` section label (and `labelClassName` restyles it).
 * - The detail's large title carries the open count on its line
 *   (`largeTitleTrailing`) and lines up with the centred content
 *   (`largeTitleClassName`).
 */
export default function HeaderOptions() {
  return (
    <div
      style={{
        position: 'relative',
        height: 520,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <SplitView
        aria-label="Reminders"
        widthClass="regular"
        defaultSelection={{ sidebar: 'today' }}
      >
        <SplitViewSidebar aria-label="Lists" width={240}>
          <SplitViewHeader title="Lists" titleOnScroll />
          <SplitViewContent style={{ padding: '0 10px' }}>
            <SplitViewSection title="My Lists" variant="prominent">
              {['Today', 'Groceries', 'Work'].map((t) => (
                <SplitViewItem key={t} id={t.toLowerCase()} title={t} />
              ))}
            </SplitViewSection>
          </SplitViewContent>
        </SplitViewSidebar>
        <SplitViewDetail aria-label="Today">
          <SplitViewHeader
            title={<span style={{ color: 'var(--primary)' }}>Today</span>}
            largeTitle
            largeTitleTrailing={
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                {reminders.length}
              </span>
            }
            largeTitleClassName="mx-auto max-w-[560px] px-5"
          />
          <SplitViewContent>
            <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px' }}>
              {reminders.map((t) => (
                <div
                  key={t}
                  style={{
                    padding: '11px 0',
                    fontSize: 17,
                    boxShadow: 'inset 0 -1px 0 var(--border)',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </SplitViewContent>
        </SplitViewDetail>
      </SplitView>
    </div>
  )
}

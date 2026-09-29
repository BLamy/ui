import { useState } from 'react'
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  type SidebarVariant,
  WorkbenchTheme,
} from '@brett_lamy/ui'

const font =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, " +
  "'Helvetica Neue', sans-serif"

const variants: SidebarVariant[] = ['docked', 'rail', 'float', 'overlay']

/**
 * One Sidebar, four variants, plus a narrow container that turns any of them
 * into the overlay.
 */
function SidebarVariants() {
  const [variant, setVariant] = useState<SidebarVariant>('docked')
  const [narrow, setNarrow] = useState(false)
  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        gap: 12,
        padding: 16,
        background: 'var(--background)',
        fontFamily: font,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {variants.map((v) => (
          <Chip key={v} active={variant === v} onPress={() => setVariant(v)}>
            {v}
          </Chip>
        ))}
        <Chip active={narrow} onPress={() => setNarrow((n) => !n)}>
          narrow container
        </Chip>
      </div>
      <div
        style={{
          width: narrow ? 380 : '100%',
          maxWidth: 640,
          height: 330,
          overflow: 'hidden',
          borderRadius: 14,
          border: '1px solid var(--border)',
          transition:
            'width var(--duration-spring-smooth) var(--ease-spring-smooth)',
        }}
      >
        {/* remount per variant so each starts in its default state */}
        <SidebarProvider
          key={variant + narrow}
          defaultOpen={variant !== 'overlay'}
          breakpoint={430}
        >
          <Nav variant={variant} />
          <SidebarInset>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 12px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {/* the hamburger toggles every variant */}
              <SidebarTrigger />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 650,
                  color: 'var(--foreground)',
                }}
              >
                Home
              </span>
            </div>
            <div
              style={{
                padding: 16,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'var(--muted-foreground)',
              }}
            >
              One API, four behaviors — the trigger toggles whichever variant is
              mounted, and every variant becomes a hamburger overlay when the
              container is narrower than the breakpoint. Try “narrow container”.
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}

function Nav({ variant }: { variant: SidebarVariant }) {
  const [page, setPage] = useState('Home')
  const item = (icon: string, label: string, badge?: number) => (
    <Sidebar.Item
      icon={icon}
      label={label}
      badge={badge}
      active={page === label}
      onPress={() => setPage(label)}
    />
  )
  return (
    <Sidebar variant={variant}>
      <Sidebar.Header>
        <Sidebar.Workspace name="Creamery Ops" detail="Production Workspace" />
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Search />
        <Sidebar.Item icon="plus" label="New task" tone="#0A84FF" />
        <Sidebar.Section title="Workspace">
          {item('home', 'Home')}
          {item('bolt', 'Agent tasks', 4)}
          {item('inbox', 'Inbox')}
        </Sidebar.Section>
        <Sidebar.Section title="Objects">
          {item('box', 'Suppliers')}
          {item('box', 'Inventory')}
        </Sidebar.Section>
      </Sidebar.Content>
    </Sidebar>
  )
}

function Chip({
  active,
  onPress,
  children,
}: {
  active: boolean
  onPress: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        cursor: 'pointer',
        border: 0,
        borderRadius: 999,
        padding: '5px 11px',
        fontFamily: font,
        fontSize: 12,
        fontWeight: 600,
        background: active ? 'var(--primary)' : 'var(--secondary-strong)',
        color: active ? '#fff' : 'var(--foreground)',
      }}
    >
      {children}
    </button>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the
// app's light / dark appearance.
export default function SidebarVariantsExample() {
  return (
    <WorkbenchTheme>
      <SidebarVariants />
    </WorkbenchTheme>
  )
}

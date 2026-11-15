import type { CSSProperties, ReactNode } from 'react'
import { Tabs, TabsAction, TabsBar, TabsFooter, TabsList, TabsPill, TabsSeparator, TabsTab } from '@/components/ui/tabs'
import { Icon } from '@/lib/icon'
import { ChatShell } from '@/components/blocks/discord-clone/components/chat-shell'

const WORKSPACE_COLORS: Record<string, string> = {
  blui: '#0A84FF',
  creamery: '#BF5AF2',
  lab: '#30D158',
}

const workspaces: {
  id: string
  label: string
  title: string
  unread?: boolean
  mentions?: number
}[] = [
  { id: 'blui', label: 'B', title: 'BL UI HQ' },
  { id: 'creamery', label: 'C', title: 'Creamery', unread: true },
  { id: 'lab', label: 'L', title: 'Motion Lab', mentions: 3 },
]

// A server tile: a circle at rest that morphs to a rounded square when its tab
// is hovered or selected (filling with the workspace color), with a mention
// badge. It reads the tab's state through `group-data-*`.
function WorkspaceTile({
  color = 'var(--primary)',
  mentions,
  children,
}: {
  color?: string
  mentions?: number
  children?: ReactNode
}) {
  return (
    <span
      style={{ '--tile': color } as CSSProperties}
      className="relative box-border grid size-[34px] shrink-0 place-items-center rounded-[17px] border-2 border-transparent bg-secondary-strong font-sans text-[14px] leading-[normal] font-extrabold text-secondary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),border-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-hover:rounded-[11px] group-data-selected:rounded-[11px] group-data-selected:border-(--tile) group-data-selected:bg-(--tile) group-data-selected:text-white group-active:scale-[.94] motion-reduce:transition-none group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-link"
    >
      {children}
      {mentions ? (
        <span className="absolute -right-[7px] -bottom-[6px] box-border flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[3px] border-muted bg-destructive px-[3px] font-sans text-[10px] leading-none font-bold text-white">
          {mentions > 99 ? '99+' : mentions}
        </span>
      ) : null}
    </span>
  )
}

// A rounded, hairline-bordered window with the page background; `width` caps
// it, centered.
function Window({ width, children }: { width?: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

// The workspace rail is a vertical Tabs with the `switcher` bar. Hover a
// tile: it rounds from a circle to a squircle and the pill on its edge grows
// from the unread nub. Select one: the pill runs full height on a springy
// curve. Up / Down move between tiles.
export default function Rail() {
  return (
    <Window width={320}>
      <ChatShell style={{ height: 300 }}>
        <Tabs
          variant="switcher"
          defaultValue="blui"
          className="contents"
        >
          <TabsBar>
            <TabsList aria-label="Workspaces">
              <TabsTab value="home" aria-label="Direct Messages">
                <TabsPill attention />
                <WorkspaceTile>
                  <Icon name="bubble-oval" size={17} sw={2} />
                </WorkspaceTile>
              </TabsTab>
              <TabsSeparator />
              {workspaces.map((w) => (
                <TabsTab key={w.id} value={w.id} aria-label={w.title}>
                  <TabsPill attention={w.unread} />
                  <WorkspaceTile
                    color={WORKSPACE_COLORS[w.id]}
                    mentions={w.mentions}
                  >
                    {w.label}
                  </WorkspaceTile>
                </TabsTab>
              ))}
            </TabsList>
            <TabsFooter>
              <TabsAction aria-label="Add workspace" icon="plus" />
            </TabsFooter>
          </TabsBar>
        </Tabs>
        <div className="flex-1 p-[18px] text-[13px] leading-normal text-muted-foreground">
          Hover and select the tiles: corners and the pill spring between
          states.
        </div>
      </ChatShell>
    </Window>
  )
}

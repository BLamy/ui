import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogView,
} from '@/components/ui/dialog'
import { List, ListRow, ListSection } from '@/components/ui/list'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLargeTitle,
  NavigationStackPage,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack'
import { Tabs, TabsBar, TabsList, TabsPanel, TabsPanels, TabsTab } from '@/components/ui/tabs'
import { BLProvider } from '@/lib/theme'

const friends = [
  { f: 'Maya', l: 'Lindqvist', city: 'Stockholm' },
  { f: 'Jonas', l: 'Ito', city: 'Osaka' },
  { f: 'Priya', l: 'Raman', city: 'Bengaluru' },
]

function FriendsTab() {
  const [open, setOpen] = useState<(typeof friends)[number] | null>(null)
  const [inviting, setInviting] = useState(false)
  return (
    <>
      <NavigationStack
        pages={open ? ['friends', 'friend'] : ['friends']}
        onPagesChange={(pages) => {
          if (pages.length === 1) setOpen(null)
        }}
      >
        <NavigationStackPage value="friends" grouped>
          <NavigationStackBar hideOnScroll={false}>
            <NavigationStackTitle>Friends</NavigationStackTitle>
          </NavigationStackBar>
          <NavigationStackContent bottomInset={62}>
            <NavigationStackLargeTitle />
            <List variant="inset">
              <ListSection>
                {friends.map((p, i) => (
                  <ListRow
                    key={p.l}
                    icon={<Avatar name={`${p.f} ${p.l}`} size={34} />}
                    title={`${p.f} ${p.l}`}
                    description={p.city}
                    accessory="chevron"
                    divider={i < friends.length - 1}
                    onClick={() => setOpen(p)}
                  />
                ))}
              </ListSection>
            </List>
          </NavigationStackContent>
        </NavigationStackPage>
        {open ? (
          <NavigationStackPage value="friend" grouped>
            <NavigationStackBar hideOnScroll={false}>
              <NavigationStackTitle>{open.f}</NavigationStackTitle>
            </NavigationStackBar>
            <NavigationStackContent>
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Avatar name={`${open.f} ${open.l}`} size={72} style={{ margin: '0 auto 12px' }} />
                <Button onClick={() => setInviting(true)}>Invite {open.f}</Button>
              </div>
            </NavigationStackContent>
          </NavigationStackPage>
        ) : null}
      </NavigationStack>
      <Dialog
        presentation="sheet"
        open={inviting}
        onOpenChange={(o) => {
          if (!o) setInviting(false)
        }}
      >
        <DialogBackdrop />
        <DialogContent variant="tray">
          <DialogHeader variant="bar">
            <DialogTitle>Invite sent</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <DialogView>
            <p
              style={{
                margin: 0,
                padding: '4px 20px 24px',
                color: 'var(--muted-foreground)',
              }}
            >
              {open?.f} will get a notification.
            </p>
          </DialogView>
        </DialogContent>
      </Dialog>
    </>
  )
}

// A rounded, phone-width window for the app to live in.
function Window({ width, children }: { width: number; children: ReactNode }) {
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

// Containers own behavior, your state owns data: a tab bar, a stack per tab,
// lists and a tray. keepMounted keeps a hidden panel mounted, so each
// tab keeps its own stack while you are on another.
export default function FirstApp() {
  return (
    <Window width={390}>
      <BLProvider style={{ height: 480 }}>
        <Tabs
          variant="bar"
          defaultValue="friends"
          style={{ position: 'absolute', inset: 0 }}
        >
          <TabsBar hideOnScroll={false}>
            <TabsList aria-label="App">
              <TabsTab value="friends" icon="person2">
                Friends
              </TabsTab>
              <TabsTab value="settings" icon="gear">
                Settings
              </TabsTab>
            </TabsList>
          </TabsBar>
          <TabsPanels>
            <TabsPanel value="friends" keepMounted>
              <FriendsTab />
            </TabsPanel>
            <TabsPanel value="settings" keepMounted>
              <p style={{ padding: 24, color: 'var(--muted-foreground)' }}>
                Each tab keeps its own stack and state.
              </p>
            </TabsPanel>
          </TabsPanels>
        </Tabs>
      </BLProvider>
    </Window>
  )
}

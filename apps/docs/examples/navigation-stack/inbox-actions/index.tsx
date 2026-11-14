import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { List, ListRow, ListSection } from '@/components/ui/list'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLeading,
  NavigationStackPage,
  NavigationStackTitle,
  NavigationStackTrailing,
} from '@/components/ui/navigation-stack'
import { Icon } from '@/lib/icon'

const seed = [
  { id: 3, from: 'Nadia Brooks', subject: 'Launch checklist' },
  { id: 2, from: 'Tom Reyes', subject: 'Onboarding copy' },
  { id: 1, from: 'Ellen Park', subject: 'Design review moved' },
]

function InboxWithActions() {
  const [mail, setMail] = useState(seed)
  const [composing, setComposing] = useState(false)
  const refresh = () => {
    setMail((m) => [
      {
        id: m.length + 1,
        from: 'Priya Raman',
        subject: `Standup notes #${m.length + 1}`,
      },
      ...m,
    ])
  }
  return (
    <div style={{ position: 'relative', height: 400 }}>
      <NavigationStack
        pages={composing ? ['inbox', 'compose'] : ['inbox']}
        onPagesChange={(pages) => setComposing(pages.includes('compose'))}
      >
        <NavigationStackPage value="inbox">
          <NavigationStackBar hideOnScroll={false}>
            <NavigationStackLeading>
              <Button variant="link" style={{ padding: '0 10px' }}>
                Edit
              </Button>
            </NavigationStackLeading>
            <NavigationStackTitle>Inbox</NavigationStackTitle>
            <NavigationStackTrailing>
              <Button
                variant="ghost"
                size="icon"
                aria-label="New message"
                onClick={() => setComposing(true)}
              >
                <Icon
                  name="compose"
                  size={22}
                  style={{ color: 'var(--primary)' }}
                />
              </Button>
            </NavigationStackTrailing>
          </NavigationStackBar>
          {/* Pull down to refresh (touch). */}
          <NavigationStackContent onRefresh={refresh}>
            <List>
              <ListSection footer="Pull down to check for new mail.">
                {mail.map((m, i) => (
                  <ListRow
                    key={m.id}
                    title={m.from}
                    subtitle={m.subject}
                    divider={i < mail.length - 1}
                    onClick={() => {}}
                  />
                ))}
              </ListSection>
            </List>
          </NavigationStackContent>
        </NavigationStackPage>
        {composing ? (
          <NavigationStackPage value="compose">
            <NavigationStackBar hideOnScroll={false}>
              <NavigationStackTitle>New Message</NavigationStackTitle>
              <NavigationStackTrailing>
                <Button
                  size="sm"
                  style={{ marginRight: 8 }}
                  onClick={() => setComposing(false)}
                >
                  Send
                </Button>
              </NavigationStackTrailing>
            </NavigationStackBar>
            <NavigationStackContent>
              <div style={{ padding: '4px 16px', fontSize: 16 }}>
                <div
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  To: Design team
                </div>
                <div
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  Subject: Friday demo
                </div>
                <p style={{ color: 'var(--muted-foreground)' }}>
                  Send pops the page by clearing the state that pushed it.
                </p>
              </div>
            </NavigationStackContent>
          </NavigationStackPage>
        ) : null}
      </NavigationStack>
    </div>
  )
}

/**
 * The rounded, hairline-bordered window the example sits in, capped to a phone
 * width and centered.
 */
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

export default function InboxActionsExample() {
  return (
    <Window width={430}>
      <InboxWithActions />
    </Window>
  )
}

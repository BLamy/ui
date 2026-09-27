/* TabView page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Badge,
  Button,
  List,
  ListRow,
  ListSection,
  TabView,
  TabViewAction,
  TabViewBar,
  TabViewFooter,
  TabViewHeader,
  TabViewIndicator,
  TabViewList,
  TabViewPanel,
  TabViewPanels,
  TabViewSeparator,
  TabViewTab,
  useAppearance,
  WorkspaceRail,
  chatVars,
} from '@brett_lamy/ui'
import raw from './tab-view.tsx?raw'
import { Window, examples } from './chrome'

// #region tabview_phone
const recents = [
  { f: 'Maya', l: 'Lindqvist', kind: 'mobile', time: '9:41 AM', missed: false },
  { f: 'Jonas', l: 'Ito', kind: 'FaceTime', time: '8:02 AM', missed: true },
  { f: 'Priya', l: 'Raman', kind: 'work', time: 'Yesterday', missed: false },
  { f: 'Leo', l: 'Okafor', kind: 'mobile', time: 'Monday', missed: false },
]

function TabScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    // The bar floats over the panel, so leave room for its 62px.
    <div style={{ padding: '14px 0 80px' }}>
      <h2 style={{ margin: '0 20px 12px', fontSize: 30, fontWeight: 800 }}>{title}</h2>
      {children}
    </div>
  )
}

export function PhoneApp() {
  return (
    <TabView defaultSelectedKey="recents" style={{ position: 'relative', height: 440 }}>
      <TabViewBar hideOnScroll={false}>
        <TabViewList aria-label="Phone">
          <TabViewTab id="favorites" icon="star" title="Favorites" />
          <TabViewTab id="recents" icon="clock" title="Recents" />
          <TabViewTab id="contacts" icon="person" title="Contacts" />
          <TabViewTab id="voicemail" icon="wave" title="Voicemail" />
        </TabViewList>
      </TabViewBar>
      <TabViewPanels>
        <TabViewPanel id="favorites">
          <TabScreen title="Favorites">
            <List inset>
              <ListSection>
                <ListRow
                  leading={<Avatar c={recents[0]} size={34} />}
                  title="Maya"
                  subtitle="mobile"
                  divider={false}
                />
              </ListSection>
            </List>
          </TabScreen>
        </TabViewPanel>
        <TabViewPanel id="recents">
          <TabScreen title="Recents">
            <List inset>
              <ListSection>
                {recents.map((c, i) => (
                  <ListRow
                    key={c.l}
                    title={
                      <span style={{ color: c.missed ? 'var(--bl-red)' : undefined }}>
                        {c.f} {c.l}
                      </span>
                    }
                    subtitle={c.kind}
                    trailing={
                      <span style={{ fontSize: 14, color: 'var(--bl-label2)' }}>
                        {c.time}
                      </span>
                    }
                    divider={i < recents.length - 1}
                  />
                ))}
              </ListSection>
            </List>
          </TabScreen>
        </TabViewPanel>
        <TabViewPanel id="contacts">
          <TabScreen title="Contacts">
            <List inset>
              <ListSection>
                {recents.map((c, i) => (
                  <ListRow
                    key={c.l}
                    leading={<Avatar c={c} size={34} />}
                    title={`${c.f} ${c.l}`}
                    accessory="chevron"
                    divider={i < recents.length - 1}
                    onPress={() => {}}
                  />
                ))}
              </ListSection>
            </List>
          </TabScreen>
        </TabViewPanel>
        <TabViewPanel id="voicemail">
          <TabScreen title="Voicemail">
            <p
              style={{
                margin: '40px 20px',
                textAlign: 'center',
                color: 'var(--bl-label2)',
              }}
            >
              No voicemail
            </p>
          </TabScreen>
        </TabViewPanel>
      </TabViewPanels>
    </TabView>
  )
}
// #endregion

// #region tabview_badges
const inboxTabs = [
  { id: 'all', label: 'All', count: 0 },
  { id: 'unread', label: 'Unread', count: 7 },
  { id: 'mentions', label: 'Mentions', count: 2 },
]
const threads = [
  {
    f: 'Nadia',
    l: 'Brooks',
    subject: 'Launch checklist',
    preview: 'Two items left before we ship…',
    unread: true,
  },
  {
    f: 'Tom',
    l: 'Reyes',
    subject: 'Re: onboarding copy',
    preview: '@you can you take a pass?',
    unread: true,
  },
  {
    f: 'Ellen',
    l: 'Park',
    subject: 'Design review',
    preview: 'Moved to Thursday at 2pm.',
    unread: false,
  },
]

export function InboxTabs() {
  const [tab, setTab] = useState('unread')
  return (
    <TabView
      placement="top"
      selectedKey={tab}
      onSelectionChange={(k) => setTab(String(k))}
      style={{ height: 360, background: 'var(--bl-card)' }}
    >
      <TabViewBar
        variant="plain"
        style={{
          alignItems: 'center',
          padding: '0 10px',
          borderBottom: '1px solid var(--bl-sep)',
        }}
      >
        <TabViewList aria-label="Inbox">
          {inboxTabs.map((t) => (
            <TabViewTab
              key={t.id}
              id={t.id}
              textValue={t.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '13px 12px 12px',
                fontSize: 14.5,
                fontWeight: 600,
              }}
            >
              {({ isSelected }) => (
                <>
                  <span
                    style={{ color: isSelected ? 'var(--bl-label)' : 'var(--bl-label2)' }}
                  >
                    {t.label}
                  </span>
                  {t.count ? (
                    <Badge variant={isSelected ? 'default' : 'secondary'}>{t.count}</Badge>
                  ) : null}
                  <TabViewIndicator />
                </>
              )}
            </TabViewTab>
          ))}
        </TabViewList>
        <TabViewFooter>
          <Button size="sm" variant="ghost">
            Mark all read
          </Button>
        </TabViewFooter>
      </TabViewBar>
      <TabViewPanels>
        {inboxTabs.map((t) => (
          <TabViewPanel key={t.id} id={t.id}>
            <List>
              <ListSection>
                {threads
                  .filter(
                    (m) =>
                      t.id === 'all' ||
                      (t.id === 'unread' ? m.unread : m.preview.includes('@')),
                  )
                  .map((m) => (
                    <ListRow
                      key={m.subject}
                      leading={<Avatar c={m} size={36} />}
                      title={m.subject}
                      subtitle={`${m.f} · ${m.preview}`}
                      onPress={() => {}}
                      trailing={
                        m.unread ? (
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 9,
                              background: 'var(--bl-tint)',
                            }}
                          />
                        ) : null
                      }
                    />
                  ))}
              </ListSection>
            </List>
          </TabViewPanel>
        ))}
      </TabViewPanels>
    </TabView>
  )
}
// #endregion

// #region tabview_rail
const mailboxes = [
  {
    id: 'inbox',
    icon: 'mail',
    title: 'Inbox',
    rows: ['Quarterly numbers', 'Offsite agenda', 'Welcome aboard'],
  },
  {
    id: 'chats',
    icon: 'message',
    title: 'Chats',
    rows: ['#design', '#launch', 'Priya Raman'],
  },
  { id: 'starred', icon: 'star', title: 'Starred', rows: ['Brand guidelines v4'] },
  {
    id: 'alerts',
    icon: 'bell',
    title: 'Alerts',
    rows: ['Build passed on main', 'New sign-in from Safari'],
  },
]

export function MailRail() {
  return (
    <TabView
      orientation="vertical"
      defaultSelectedKey="inbox"
      style={{ height: 440, background: 'var(--bl-bg)' }}
    >
      <TabViewBar>
        <TabViewHeader style={{ padding: '6px 0 10px' }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--bl-tint)',
              color: '#fff',
              fontWeight: 800,
            }}
          >
            M
          </span>
        </TabViewHeader>
        <TabViewList aria-label="Mailboxes">
          {mailboxes.map((m) => (
            <TabViewTab key={m.id} id={m.id} icon={m.icon} title={m.title} />
          ))}
        </TabViewList>
        <TabViewAction
          icon="compose"
          title="New"
          aria-label="New message"
          onPress={() => {}}
        />
        <TabViewFooter style={{ paddingBottom: 6 }}>
          <Avatar c={{ f: 'Ada', l: 'Lovelace' }} size={32} />
        </TabViewFooter>
      </TabViewBar>
      <TabViewPanels>
        {mailboxes.map((m) => (
          <TabViewPanel key={m.id} id={m.id}>
            <h3 style={{ margin: '18px 20px 10px', fontSize: 20 }}>{m.title}</h3>
            <List inset>
              <ListSection>
                {m.rows.map((r, i) => (
                  <ListRow
                    key={r}
                    title={r}
                    accessory="chevron"
                    divider={i < m.rows.length - 1}
                    onPress={() => {}}
                  />
                ))}
              </ListSection>
            </List>
          </TabViewPanel>
        ))}
      </TabViewPanels>
    </TabView>
  )
}
// #endregion

// #region tabview_inspector
export function EditorInspector() {
  return (
    <div style={{ display: 'flex', height: 360, background: 'var(--bl-bg)' }}>
      <main style={{ flex: 1, minWidth: 0, padding: 24, background: 'var(--bl-bg2)' }}>
        <div
          style={{
            height: '100%',
            borderRadius: 12,
            background: 'var(--bl-card)',
            boxShadow: '0 0 0 1px var(--bl-sep)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--bl-label2)',
          }}
        >
          Canvas
        </div>
      </main>
      {/* placement="end": the rail sits on the trailing edge, panels open beside it */}
      <TabView
        placement="end"
        defaultSelectedKey="info"
        style={{ width: 300, borderLeft: '1px solid var(--bl-sep)' }}
      >
        <TabViewBar style={{ width: 56 }}>
          <TabViewList aria-label="Inspector">
            <TabViewTab id="info" icon="info" textValue="Info" />
            <TabViewTab id="comments" icon="message" textValue="Comments" />
            <TabViewSeparator />
            <TabViewTab id="history" icon="clock" textValue="History" />
          </TabViewList>
        </TabViewBar>
        <TabViewPanels>
          <TabViewPanel id="info" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>Frame 12</strong>
            <p style={{ color: 'var(--bl-label2)' }}>390 × 844 · Auto layout</p>
          </TabViewPanel>
          <TabViewPanel id="comments" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>2 comments</strong>
            <p style={{ color: 'var(--bl-label2)' }}>“Tighten the header spacing.”</p>
          </TabViewPanel>
          <TabViewPanel id="history" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>Version history</strong>
            <p style={{ color: 'var(--bl-label2)' }}>Autosaved 2 minutes ago</p>
          </TabViewPanel>
        </TabViewPanels>
      </TabView>
    </div>
  )
}
// #endregion

// #region tabview_workspaces
const servers = [
  { id: 'design', label: 'D', color: '#0A84FF', title: 'Design Team' },
  { id: 'eng', label: 'E', color: '#BF5AF2', title: 'Engineering', unread: true },
  { id: 'ops', label: 'O', color: '#FF9F0A', title: 'Ops', mentions: 3 },
]
const channels: Record<string, string[]> = {
  home: ['Maya Lindqvist', 'Jonas Ito'],
  design: ['general', 'critique', 'inspiration'],
  eng: ['general', 'deploys', 'incidents'],
  ops: ['general', 'on-call'],
}

export function ChatWorkspaces() {
  const [server, setServer] = useState('design')
  // WorkspaceRail reads the chat --ck-* tokens; chatVars follows light / dark.
  const appearance = useAppearance() ?? 'light'
  return (
    <div
      style={{
        ...chatVars(appearance),
        display: 'flex',
        height: 340,
        background: 'var(--ck-bg)',
        color: 'var(--ck-label)',
      }}
    >
      <WorkspaceRail
        home={{ title: 'Direct Messages', mentions: 1 }}
        workspaces={servers}
        selectedKey={server}
        onSelect={setServer}
        onAdd={() => {}}
      />
      <nav
        style={{
          width: 190,
          padding: '14px 8px',
          background: 'var(--ck-side)',
          borderRight: '1px solid var(--ck-sep)',
        }}
      >
        <div style={{ padding: '0 8px 10px', fontWeight: 700 }}>
          {server === 'home'
            ? 'Direct Messages'
            : servers.find((s) => s.id === server)?.title}
        </div>
        {channels[server].map((c, i) => (
          <div
            key={c}
            style={{
              padding: '6px 8px',
              borderRadius: 7,
              fontSize: 13.5,
              background: i === 0 ? 'var(--ck-fill2)' : undefined,
              color: i === 0 ? 'var(--ck-label)' : 'var(--ck-mut)',
            }}
          >
            {server === 'home' ? c : `# ${c}`}
          </div>
        ))}
      </nav>
      <main style={{ flex: 1, padding: 20, fontSize: 13.5, color: 'var(--ck-mut)' }}>
        Up / Down moves between workspaces; the pill marks unread, hover and selection.
      </main>
    </div>
  )
}
// #endregion

export const TAB_VIEW_LIVE = examples(raw, [
  {
    id: 'tabview_phone',
    title: 'Bottom tab bar · Phone',
    h: 470,
    Render: () => (
      <Window width={390} bg="var(--bl-bg2)">
        <PhoneApp />
      </Window>
    ),
  },
  {
    id: 'tabview_badges',
    title: 'Top tabs with badges and a sliding indicator',
    h: 390,
    Render: () => (
      <Window>
        <InboxTabs />
      </Window>
    ),
  },
  {
    id: 'tabview_rail',
    title: 'Vertical rail with header, action and footer',
    h: 410,
    Render: () => (
      <Window>
        <MailRail />
      </Window>
    ),
  },
  {
    id: 'tabview_inspector',
    title: 'Trailing inspector tabs',
    h: 390,
    Render: () => (
      <Window>
        <EditorInspector />
      </Window>
    ),
  },
  {
    id: 'tabview_workspaces',
    title: 'Chat workspaces · WorkspaceRail',
    h: 370,
    Render: () => (
      <Window>
        <ChatWorkspaces />
      </Window>
    ),
  },
])

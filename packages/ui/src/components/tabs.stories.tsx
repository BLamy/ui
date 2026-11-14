import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Tabs, TabsAction, TabsBar, TabsFooter, TabsHeader, TabsIndicator, TabsList, TabsPanel, TabsPanels, TabsPill,
  TabsSeparator, TabsTab, type TabsSide, type TabsVariant,
} from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { List, ListRow, ListSection } from '@/components/ui/list';
import {
  NavigationStack, NavigationStackBar, NavigationStackContent, NavigationStackLargeTitle, NavigationStackPage,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack';
import { useSizeClass } from '@/lib/container';
import { Icon, type IconName } from '@/lib/icon';
import { BLProvider, ThemeScope } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Phone } from '../stories/frame';
import { Panel } from '../stories/primitive-frame';

interface Args { variant?: TabsVariant; side?: TabsSide; dark?: boolean }
const meta: Meta<Args> = { title: 'Molecules/Tabs' };
export default meta;
type Story = StoryObj<Args>;

/* ── In-page looks: segmented and underline ── */

const settings = [
  { id: 'account', title: 'Account', body: 'Name, email and password.', icon: 'person' },
  { id: 'privacy', title: 'Privacy', body: 'Who can see your activity.', icon: 'lock' },
  { id: 'billing', title: 'Billing', body: 'Plan, invoices and payment.', icon: 'creditcard' },
] as const;

function SettingsTabs({ variant, side, icons, disabled, activation }: {
  variant: 'segmented' | 'underline'; side?: TabsSide; icons?: boolean; disabled?: string; activation?: 'manual';
}) {
  return (
    <Tabs variant={variant} side={side} activation={activation} defaultValue="account">
      <TabsList aria-label="Settings">
        {settings.map((s) => (
          <TabsTab key={s.id} value={s.id} icon={icons ? s.icon : undefined} disabled={s.id === disabled}>{s.title}</TabsTab>
        ))}
      </TabsList>
      {settings.map((s) => (
        <TabsPanel key={s.id} value={s.id} className="min-w-0 flex-1">
          <Card>
            <CardHeader><CardTitle>{s.title}</CardTitle><CardDescription>{s.body}</CardDescription></CardHeader>
            <CardContent className="text-muted-foreground">Content for {s.title.toLowerCase()}.</CardContent>
          </Card>
        </TabsPanel>
      ))}
    </Tabs>
  );
}

/** The iOS segmented control as tabs: a tinted track and a card that slides to the selected tab. The selected label
    is semibold, the rest medium. */
export const Segmented: Story = {
  args: { dark: false },
  render: ({ dark }) => <Panel dark={dark}><SettingsTabs variant="segmented" /></Panel>,
};

/** A tinted line under the selected label, over a hairline. */
export const Underline: Story = {
  args: { dark: false },
  render: ({ dark }) => <Panel dark={dark}><SettingsTabs variant="underline" /></Panel>,
};

export const Dark: Story = {
  render: () => (
    <Panel dark>
      <SettingsTabs variant="segmented" />
      <SettingsTabs variant="underline" />
    </Panel>
  ),
};

/** `icon` takes a glyph name or a node; it is decorative, so the tab is still named by its label. */
export const WithIcons: Story = {
  args: { dark: false },
  render: ({ dark }) => (
    <Panel dark={dark} w={420}>
      <SettingsTabs variant="segmented" icons />
      <SettingsTabs variant="underline" icons />
    </Panel>
  ),
};

/** A disabled tab is dimmed and can't be selected; arrow keys still reach it, so it can be found. */
export const Disabled: Story = {
  args: { dark: false },
  render: ({ dark }) => (
    <Panel dark={dark}>
      <SettingsTabs variant="segmented" disabled="billing" />
      <SettingsTabs variant="underline" disabled="billing" />
    </Panel>
  ),
};

/** `side="start"` stands the list up beside the panels; Up and Down move between tabs. */
export const Vertical: Story = {
  args: { dark: false },
  render: ({ dark }) => (
    <Panel dark={dark} w={560}>
      <SettingsTabs variant="underline" side="start" />
      <SettingsTabs variant="segmented" side="start" />
    </Panel>
  ),
};

/** `activation="manual"`: the arrow keys only move focus (the ring), and Enter or Space selects. */
export const ManualActivation: Story = {
  render: () => <Panel><SettingsTabs variant="segmented" activation="manual" /></Panel>,
};

/* ── The bottom tab bar (variant="bar") ── */

const sections: { id: string; title: string; icon: IconName; body: string }[] = [
  { id: 'contacts', title: 'Contacts', icon: 'person', body: 'Everyone you know, A to Z.' },
  { id: 'recents', title: 'Recents', icon: 'clock', body: 'Calls and messages from the last week.' },
  { id: 'favorites', title: 'Favorites', icon: 'star', body: 'The people you reach most.' },
  { id: 'settings', title: 'Settings', icon: 'sliders', body: 'Accounts, sync and notifications.' },
];

function PanelBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="box-border flex h-full flex-col gap-1.5 p-6">
      <div className="text-title font-bold text-foreground">{title}</div>
      <div className="text-detail text-muted-foreground">{body}</div>
    </div>
  );
}

function BottomTabs({ panels = true, defaultValue = 'contacts' }: { panels?: boolean; defaultValue?: string }) {
  return (
    <Tabs variant="bar" defaultValue={defaultValue} className="absolute inset-0">
      <TabsBar>
        <TabsList aria-label="Sections">
          {sections.map((s) => <TabsTab key={s.id} value={s.id} icon={s.icon}>{s.title}</TabsTab>)}
        </TabsList>
      </TabsBar>
      {panels ? (
        <TabsPanels>
          {sections.map((s) => <TabsPanel key={s.id} value={s.id}><PanelBody title={s.title} body={s.body} /></TabsPanel>)}
        </TabsPanels>
      ) : null}
    </Tabs>
  );
}

/** The iOS tab bar on a phone: panels above, the translucent bar pinned at the bottom. Arrow keys move left and right;
    each panel scrolls on its own and the next one slides in from the side of the tab you picked. */
export const BottomBar: Story = {
  args: { dark: false },
  render: ({ dark }) => <Phone w={390} h={720} dark={dark}><BottomTabs /></Phone>,
};

export const BottomBarDark: Story = {
  render: () => <Phone w={390} h={720} dark><BottomTabs defaultValue="recents" /></Phone>,
};

const rows = (n: number) => (
  <List>
    <ListSection title="Recent">
      {Array.from({ length: n }, (_, i) => (
        <ListRow key={i} title={`Row ${i + 1}`} description="Scroll down and the bars ride away" divider={i < n - 1} />
      ))}
    </ListSection>
  </List>
);

/** Hide on scroll: each tab is a NavigationStack, and scrolling one down slides the tab bar away with the nav bar
    (the kit's shared chrome state); scrolling up, or back near the top, brings both back. `hideOnScroll={false}` on
    `TabsBar` pins it. */
export const BottomBarHideOnScroll: Story = {
  args: { dark: false },
  render: function HideOnScroll({ dark }) {
    const [tab, setTab] = useState('contacts');
    return (
      <Phone w={390} h={720} dark={dark}>
        <Tabs variant="bar" value={tab} onValueChange={(next) => { if (next) setTab(next); }} className="absolute inset-0">
          <TabsBar>
            <TabsList aria-label="Sections">
              {sections.map((s) => <TabsTab key={s.id} value={s.id} icon={s.icon}>{s.title}</TabsTab>)}
            </TabsList>
          </TabsBar>
          <TabsPanels>
            {sections.map((s) => (
              <TabsPanel key={s.id} value={s.id} keepMounted className="overflow-hidden">
                <NavigationStack defaultPages={['root']} bottomInset={66}>
                  <NavigationStackPage value="root">
                    <NavigationStackBar><NavigationStackTitle>{s.title}</NavigationStackTitle></NavigationStackBar>
                    <NavigationStackContent bottomInset={66}>
                      <NavigationStackLargeTitle />
                      {rows(40)}
                    </NavigationStackContent>
                  </NavigationStackPage>
                </NavigationStack>
              </TabsPanel>
            ))}
          </TabsPanels>
        </Tabs>
      </Phone>
    );
  },
};

/** The bar with no panels, for a host that shows the screen itself (an app router): Tabs carry no `aria-controls`. */
export const BottomBarOnly: Story = {
  render: function BarOnly() {
    const [tab, setTab] = useState('recents');
    return (
      <Phone w={390} h={360}>
        <div className="absolute inset-0 grid place-items-center text-subhead text-muted-foreground">Showing: {tab}</div>
        <Tabs variant="bar" value={tab} onValueChange={(next) => { if (next) setTab(next); }} className="contents">
          <TabsBar>
            <TabsList aria-label="Sections">
              {sections.slice(0, 3).map((s) => <TabsTab key={s.id} value={s.id} icon={s.icon}>{s.title}</TabsTab>)}
            </TabsList>
          </TabsBar>
        </Tabs>
      </Phone>
    );
  },
};

/** One tree at every size: a bottom bar when the box is compact, a side rail from 700px (its own size class, not the
    viewport). Screenshot it at 390x844 and wide. */
export const Adaptive: Story = {
  args: { dark: false },
  render: function AdaptiveTabs({ dark }) {
    const [box, sizeClass] = useSizeClass<HTMLDivElement>({ breakpoints: { medium: 700 }, initial: 'compact' });
    const compact = sizeClass === 'compact';
    return (
      <div ref={box} className="relative h-[640px] w-full overflow-hidden rounded-card shadow-hairline">
        <BLProvider dark={dark} className="absolute inset-0">
          <Tabs variant={compact ? 'bar' : 'rail'} defaultValue="contacts" className="absolute inset-0 bg-background">
            <TabsBar>
              <TabsList aria-label="Sections">
                {sections.map((s) => <TabsTab key={s.id} value={s.id} icon={s.icon}>{s.title}</TabsTab>)}
              </TabsList>
            </TabsBar>
            <TabsPanels>
              {sections.map((s) => <TabsPanel key={s.id} value={s.id}><PanelBody title={s.title} body={s.body} /></TabsPanel>)}
            </TabsPanels>
          </Tabs>
        </BLProvider>
      </div>
    );
  },
};

/* ── Side rail (variant="rail") ── */

/** A sized, rounded frame for desktop-shaped compositions. */
function Desk({ children, w = 720, h = 440, dark }: { children: ReactNode; w?: number; h?: number; dark?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-card shadow-hairline" style={{ width: w, height: h }}>
      <BLProvider dark={dark}>{children}</BLProvider>
    </div>
  );
}

/** A rail of icons over labels, with a logo in `TabsHeader`, Compose as a `TabsAction` (a button, not a tab) and the
    account in `TabsFooter`, pinned to the far end. `side="end"` puts it on the trailing edge. */
export const Rail: Story = {
  args: { side: 'start', dark: false },
  argTypes: { side: { control: 'inline-radio', options: ['start', 'end'] } },
  render: ({ side, dark }) => (
    <Desk dark={dark}>
      <Tabs variant="rail" side={side} defaultValue="recents" className="absolute inset-0 bg-background">
        <TabsBar>
          <TabsHeader className="mb-1 h-10">
            <span className="grid size-8 place-items-center rounded-ctl bg-primary text-subhead font-extrabold text-primary-foreground">B</span>
          </TabsHeader>
          <TabsList aria-label="Sections">
            {sections.map((s) => <TabsTab key={s.id} value={s.id} icon={s.icon}>{s.title}</TabsTab>)}
          </TabsList>
          <TabsAction icon="compose" aria-label="New message">New</TabsAction>
          <TabsFooter className="pt-1 pb-1">
            <span className="grid size-9 place-items-center rounded-full bg-secondary-strong text-footnote font-bold text-muted-foreground">BL</span>
          </TabsFooter>
        </TabsBar>
        <TabsPanels>
          {sections.map((s) => <TabsPanel key={s.id} value={s.id}><PanelBody title={s.title} body={s.body} /></TabsPanel>)}
        </TabsPanels>
      </Tabs>
    </Desk>
  ),
};

export const RailDark: Story = { ...Rail, args: { side: 'start', dark: true } };

/* ── Workspace switcher (variant="workspace") ── */

const workspaces = [
  { id: 'blui', label: 'B', color: 'var(--primary)', title: 'BL UI HQ' },
  { id: 'creamery', label: 'C', color: 'var(--chart-4, var(--primary))', title: 'Creamery', unread: true },
  { id: 'labs', label: 'L', color: 'var(--success)', title: 'Labs', mentions: 4 },
  { id: 'ops', label: 'O', color: 'var(--warning)', title: 'Ops', unread: true, mentions: 12 },
];

/** Discord's tile: a circle at rest that morphs into a rounded square when hovered or selected, filling with its color.
    It styles itself from the tab through `group-hover:` and `group-data-selected:`. */
function Tile({ color = 'var(--primary)', mentions, children }: { color?: string; mentions?: number; children: ReactNode }) {
  return (
    <span style={{ '--tile': color } as CSSProperties}
      className="relative box-border grid size-[34px] shrink-0 place-items-center rounded-[17px] border-2 border-transparent bg-secondary-strong font-sans text-detail font-extrabold text-secondary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-hover:rounded-[11px] group-data-selected:rounded-[11px] group-data-selected:bg-(--tile) group-data-selected:text-primary-foreground motion-reduce:transition-none group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring">
      {children}
      {mentions ? (
        <span className="absolute -right-[7px] -bottom-[6px] box-border flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[3px] border-muted bg-destructive px-[3px] text-[10px] leading-none font-bold text-primary-foreground">
          {mentions > 99 ? '99+' : mentions}
        </span>
      ) : null}
    </span>
  );
}

function WorkspaceRail({ count }: { count?: number }) {
  const list = count ? Array.from({ length: count }, (_, i) => ({ ...workspaces[i % 4], id: `w${i}`, label: String.fromCharCode(65 + i), title: `Workspace ${i + 1}` })) : workspaces;
  return (
    <Tabs variant="workspace" defaultValue={count ? 'w0' : 'blui'} className="flex h-full">
      <TabsBar>
        <TabsList aria-label="Workspaces">
          <TabsTab value="home" aria-label="Direct Messages">
            <TabsPill />
            <Tile mentions={2}><Icon name="bubble-oval" size={17} sw={2} /></Tile>
          </TabsTab>
          <TabsSeparator />
          {list.map((w) => (
            <TabsTab key={w.id} value={w.id} aria-label={w.title}>
              <TabsPill attention={'unread' in w ? w.unread : false} />
              <Tile color={w.color} mentions={'mentions' in w ? w.mentions : undefined}>{w.label}</Tile>
            </TabsTab>
          ))}
        </TabsList>
        <TabsFooter>
          <TabsAction aria-label="Add workspace" icon="plus" />
        </TabsFooter>
      </TabsBar>
    </Tabs>
  );
}

/** The workspace switcher: a narrow column of tiles in the chat scope. Home sits over a separator, each tab has a
    `TabsPill` on its leading edge (a nub for unread, taller on hover, full when selected), and "Add workspace" is a
    `TabsAction` that follows the list. On touch the tiles' hit areas grow to 44px. */
export const Workspace: Story = {
  args: { dark: true },
  render: ({ dark }) => (
    <ThemeScope scope="chat" appearance={dark ? 'dark' : 'light'} className="flex h-[480px] w-[200px] overflow-hidden bg-background text-foreground">
      <WorkspaceRail />
    </ThemeScope>
  ),
};

export const WorkspaceLight: Story = { ...Workspace, args: { dark: false } };

/** More tiles than room: the list scrolls between the header and the footer. */
export const WorkspaceScrolling: Story = {
  render: () => (
    <ThemeScope scope="chat" appearance="dark" className="flex h-[300px] w-[200px] overflow-hidden bg-background text-foreground">
      <WorkspaceRail count={12} />
    </ThemeScope>
  ),
};

/* ── Plain: the host draws the bar ── */

const filters = [
  { id: 'all', title: 'All', count: 128 },
  { id: 'unread', title: 'Unread', count: 7 },
  { id: 'mentions', title: 'Mentions', count: 2 },
  { id: 'archived', title: 'Archived', count: 0 },
];

/** A `plain` bar with fully custom tabs: a function child gets each tab's state, one `TabsIndicator` slides between
    them, and `TabsFooter` pushes an action to the far end. */
export const CustomTabs: Story = {
  args: { dark: false },
  render: ({ dark }) => (
    <Desk dark={dark} w={560} h={300}>
      <Tabs variant="plain" defaultValue="unread" className="absolute inset-0 bg-background">
        <TabsBar className="gap-1 px-4 pt-3 shadow-hairline-b">
          <TabsList aria-label="Inbox filters" className="gap-1">
            {filters.map((f) => (
              <TabsTab key={f.id} value={f.id} className="px-2.5 pt-1.5 pb-3">
                {({ selected }) => (
                  <span className={cn('flex items-center gap-1.5 text-detail font-semibold transition-colors duration-150',
                    selected ? 'text-foreground' : 'text-muted-foreground group-hover/tab:text-foreground')}>
                    {f.title}
                    <span className={cn('rounded-full px-1.5 py-px text-caption2 font-bold tabular-nums',
                      selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{f.count}</span>
                  </span>
                )}
              </TabsTab>
            ))}
            <TabsIndicator className="inset-x-2.5" />
          </TabsList>
          <TabsFooter>
            <TabsAction aria-label="Filter settings" icon="sliders" className="grid size-8 place-items-center rounded-ctl text-muted-foreground hover:bg-secondary" />
          </TabsFooter>
        </TabsBar>
        <TabsPanels>
          {filters.map((f) => (
            <TabsPanel key={f.id} value={f.id}>
              <PanelBody title={f.title} body={f.count ? `${f.count} conversations.` : 'Nothing here.'} />
            </TabsPanel>
          ))}
        </TabsPanels>
      </Tabs>
    </Desk>
  ),
};

/** Order-independent: the panels are written before the bar. A bar that is a direct child and comes after the panels
    is laid out ahead of them, so `side` still puts it where it says: this renders exactly like `BottomBar`. */
export const PanelsFirst: Story = {
  render: () => (
    <Phone w={390} h={420}>
      <Tabs variant="bar" defaultValue="contacts" className="absolute inset-0">
        <TabsPanels>
          {sections.map((s) => <TabsPanel key={s.id} value={s.id}><PanelBody title={s.title} body={s.body} /></TabsPanel>)}
        </TabsPanels>
        <TabsBar>
          <TabsList aria-label="Sections">
            {sections.map((s) => <TabsTab key={s.id} value={s.id} icon={s.icon}>{s.title}</TabsTab>)}
          </TabsList>
        </TabsBar>
      </Tabs>
    </Phone>
  ),
};

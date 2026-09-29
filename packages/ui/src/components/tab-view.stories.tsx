import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  TabView, TabViewAction, TabViewBar, TabViewFooter, TabViewHeader, TabViewIndicator, TabViewList, TabViewPanel,
  TabViewPanels, TabViewSeparator, TabViewTab, type TabViewPlacement,
} from './tab-view';
import { Icon } from '../lib/icon';
import { BLProvider, ThemeScope } from '../lib/theme';
import { cn } from '../lib/utils';
import { Phone } from '../stories/frame';

interface Args { placement?: TabViewPlacement; dark?: boolean }
const meta: Meta<Args> = { title: 'Molecules/TabView' };
export default meta;
type Story = StoryObj<Args>;

/** A sized, rounded frame (like Phone) for desktop-shaped compositions. */
function Panel({ children, w = 720, h = 440, dark }: { children: ReactNode; w?: number; h?: number; dark?: boolean }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,.18)', width: w, height: h }}>
      <BLProvider dark={dark}>{children}</BLProvider>
    </div>
  );
}

const sections = [
  { id: 'contacts', title: 'Contacts', icon: 'person', body: 'Everyone you know, A to Z.' },
  { id: 'recents', title: 'Recents', icon: 'clock', body: 'Calls and messages from the last week.' },
  { id: 'favorites', title: 'Favorites', icon: 'star', body: 'The people you reach most.' },
  { id: 'settings', title: 'Settings', icon: 'sliders', body: 'Accounts, sync and notifications.' },
];

function PanelBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="box-border flex h-full flex-col gap-1.5 p-6">
      <div className="text-[22px] font-bold tracking-[-.3px] text-foreground">{title}</div>
      <div className="text-[14px] text-muted-foreground">{body}</div>
    </div>
  );
}

/** The iOS shape: panels above, the translucent bar pinned at the bottom. Arrow keys move left/right. */
export const Bottom: Story = {
  render: () => (
    <Phone w={390} h={420}>
      <TabView defaultSelectedKey="contacts" className="absolute inset-0">
        <TabViewBar>
          <TabViewList aria-label="Sections">
            {sections.map((s) => <TabViewTab key={s.id} id={s.id} icon={s.icon} title={s.title} />)}
          </TabViewList>
        </TabViewBar>
        <TabViewPanels>
          {sections.map((s) => <TabViewPanel key={s.id} id={s.id}><PanelBody title={s.title} body={s.body} /></TabViewPanel>)}
        </TabViewPanels>
      </TabView>
    </Phone>
  ),
};

/** Vertical: the same parts with `placement="start"` become a left rail (icons over labels). Up/Down arrows
    move between tabs; the header (logo) and footer (account button) aren't tabs. */
export const VerticalRail: Story = {
  args: { placement: 'start', dark: false },
  argTypes: { placement: { control: 'inline-radio', options: ['start', 'end'] } },
  render: ({ placement, dark }) => (
    <Panel dark={dark}>
      <TabView placement={placement} defaultSelectedKey="recents" className="absolute inset-0 bg-background">
        <TabViewBar>
          <TabViewHeader className="mb-1 h-10">
            <div className="grid size-8 place-items-center rounded-[9px] bg-primary text-[15px] font-extrabold text-white">B</div>
          </TabViewHeader>
          <TabViewList aria-label="Sections" className="flex-1">
            {sections.map((s) => (
              <TabViewTab key={s.id} id={s.id} textValue={s.title} className={cn(s.id === 'settings' && 'mt-auto')}>
                {({ isSelected }) => (
                  <>
                    <TabViewIndicator className="-start-1.5" />
                    <Icon name={s.icon} size={24} sw={isSelected ? 2.1 : 1.8} />
                    <span className="text-[10.5px] font-semibold tracking-[.1px]">{s.title}</span>
                  </>
                )}
              </TabViewTab>
            ))}
          </TabViewList>
          <TabViewFooter className="pt-1 pb-1">
            <TabViewAction aria-label="Account" className="grid size-9 place-items-center rounded-full bg-secondary-strong text-[13px] font-bold text-muted-foreground data-hovered:bg-secondary">
              BL
            </TabViewAction>
          </TabViewFooter>
        </TabViewBar>
        <TabViewPanels>
          {sections.map((s) => <TabViewPanel key={s.id} id={s.id}><PanelBody title={s.title} body={s.body} /></TabViewPanel>)}
        </TabViewPanels>
      </TabView>
    </Panel>
  ),
};

/* ── Discord-style rail, from the same parts (the chat kit's WorkspaceRail is this composition) ── */
const servers = [
  { id: 'bl', label: 'BL', color: '#0A84FF', title: 'BL UI HQ' },
  { id: 'cr', label: 'C', color: '#BF5AF2', title: 'Creamery', unread: true },
  { id: 'ds', label: 'DS', color: '#FF9F0A', title: 'Design Systems', mentions: 3 },
  { id: 'rx', label: 'R', color: '#32D74B', title: 'React Aria', unread: true, mentions: 12 },
];

function RailTile({ color, children, badge }: { color: string; children: ReactNode; badge?: number }) {
  return (
    <span style={{ '--tile': color } as CSSProperties}
      className="relative box-border grid size-10 place-items-center rounded-[14px] bg-secondary-strong text-[14px] font-extrabold text-foreground transition-[border-radius,background-color,color] duration-200 ease-ios group-data-hovered:rounded-[12px] group-data-selected:rounded-[12px] group-data-selected:bg-(--tile) group-data-selected:text-white group-data-hovered:bg-(--tile) group-data-hovered:text-white group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-primary">
      {children}
      {!!badge && (
        <span className="absolute -right-1.5 -bottom-1 box-border flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-[3px] border-muted bg-destructive px-[3px] text-[10px] leading-none font-bold text-white">
          {badge}
        </span>
      )}
    </span>
  );
}

function DiscordRailDemo({ dark }: { dark: boolean }) {
  const [sel, setSel] = useState('bl');
  const current = sel === 'home' ? 'Direct Messages' : servers.find((s) => s.id === sel)?.title;
  return (
    <Panel dark={dark} w={520} h={440}>
      <TabView orientation="vertical" selectedKey={sel} onSelectionChange={(k) => setSel(String(k))} className="absolute inset-0 bg-background">
        <TabViewBar variant="plain" className="w-[64px] items-center gap-2 bg-muted py-3 [border-right:1px_solid_var(--border)]">
          <TabViewList aria-label="Servers" className="w-full items-center gap-2">
            <TabViewTab id="home" textValue="Direct Messages" className="group flex w-full justify-center">
              <TabViewIndicator variant="pill" className="h-0 data-hovered:h-4 data-selected:h-8" />
              <RailTile color="var(--primary)"><Icon name="message" size={20} /></RailTile>
            </TabViewTab>
            <TabViewSeparator className="h-0.5 w-6 rounded-full" />
            {servers.map((s) => (
              <TabViewTab key={s.id} id={s.id} textValue={s.title} className="group flex w-full justify-center">
                <TabViewIndicator variant="pill" attention={s.unread} className="data-attention:h-2 data-hovered:h-4 data-selected:h-8" />
                <RailTile color={s.color} badge={s.mentions}>{s.label}</RailTile>
              </TabViewTab>
            ))}
          </TabViewList>
          <TabViewAction aria-label="Add a server"
            className="group grid size-10 place-items-center rounded-[14px] bg-secondary-strong text-[#32D74B] transition-[border-radius,background-color,color] duration-200 ease-ios data-hovered:rounded-[12px] data-hovered:bg-[#32D74B] data-hovered:text-white">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5.5v13M5.5 12h13" /></svg>
          </TabViewAction>
        </TabViewBar>
        <div className="box-border flex min-w-0 flex-1 flex-col gap-1.5 p-6">
          <div className="text-[22px] font-bold tracking-[-.3px] text-foreground">{current}</div>
          <div className="text-[14px] text-muted-foreground">Up/Down arrows move between servers; the separator and the add button aren’t tabs.</div>
        </div>
      </TabView>
    </Panel>
  );
}

/** A Discord server rail built from TabView parts: custom tiles as tabs, the `pill` indicator (a nub for
    unread, taller on hover, full when selected), mention badges, a separator under Home, and an Add action. */
export const DiscordRail: Story = {
  args: { dark: true },
  render: ({ dark }) => <DiscordRailDemo dark={!!dark} />,
};

/* ── Custom-rendered tabs ── */
const filters = [
  { id: 'all', title: 'All', count: 128 },
  { id: 'unread', title: 'Unread', count: 7 },
  { id: 'mentions', title: 'Mentions', count: 2 },
  { id: 'archived', title: 'Archived', count: 0 },
];

/** `placement="top"` with a plain bar and fully custom tabs: the render prop hands each tab its state
    (isSelected, isHovered, isFocusVisible…), and `TabViewIndicator` slides the underline between them. */
export const CustomTabs: Story = {
  args: { dark: false },
  render: ({ dark }) => (
    <Panel dark={dark} w={560} h={300}>
      <TabView placement="top" defaultSelectedKey="unread" className="absolute inset-0 bg-background">
        <TabViewBar variant="plain" className="gap-1 px-4 pt-3 shadow-[inset_0_-1px_0_var(--border)]">
          <TabViewList aria-label="Inbox filters" className="gap-1">
            {filters.map((f) => (
              <TabViewTab key={f.id} id={f.id} textValue={f.title} className="group px-2.5 pt-1.5 pb-3">
                {({ isSelected }) => (
                  <>
                    <span className={cn('flex items-center gap-1.5 text-[14px] font-semibold transition-colors duration-150',
                      isSelected ? 'text-foreground' : 'text-tertiary-foreground group-data-hovered:text-muted-foreground')}>
                      {f.title}
                      <span className={cn('rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums',
                        isSelected ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')}>{f.count}</span>
                    </span>
                    <TabViewIndicator className="inset-x-2.5" />
                  </>
                )}
              </TabViewTab>
            ))}
          </TabViewList>
          <TabViewFooter>
            <TabViewAction aria-label="Filter settings" className="grid size-8 place-items-center rounded-lg text-tertiary-foreground data-hovered:bg-secondary">
              <Icon name="sliders" size={18} />
            </TabViewAction>
          </TabViewFooter>
        </TabViewBar>
        <TabViewPanels>
          {filters.map((f) => (
            <TabViewPanel key={f.id} id={f.id}>
              <PanelBody title={f.title} body={f.count ? `${f.count} conversations.` : 'Nothing here.'} />
            </TabViewPanel>
          ))}
        </TabViewPanels>
      </TabView>
    </Panel>
  ),
};

/** Order-independent: the panels are written before the bar. TabView moves a direct-child bar ahead of the
    panels (so react-aria has minted its tab ids, and `placement` still puts the bar at the bottom) — this
    renders exactly like `Bottom`, with no "There is no tab id" error. */
export const PanelsFirst: Story = {
  render: () => (
    <Phone w={390} h={420}>
      <TabView defaultSelectedKey="contacts" className="absolute inset-0">
        <TabViewPanels>
          {sections.map((s) => <TabViewPanel key={s.id} id={s.id}><PanelBody title={s.title} body={s.body} /></TabViewPanel>)}
        </TabViewPanels>
        <TabViewBar>
          <TabViewList aria-label="Sections">
            {sections.map((s) => <TabViewTab key={s.id} id={s.id} icon={s.icon} title={s.title} />)}
          </TabViewList>
        </TabViewBar>
      </TabView>
    </Phone>
  ),
};

/** Panels first with the bar nested in a wrapper: TabViewPanels waits one layout pass (before paint) for the
    tablist, so this works too. Here the wrapper is laid out by hand (the panels fill, the bar pins to the top). */
export const PanelsFirstNested: Story = {
  render: () => (
    <Panel w={560} h={320}>
      <TabView placement="top" defaultSelectedKey="recents" className="absolute inset-0 bg-background">
        <TabViewPanels className="order-2">
          {sections.map((s) => <TabViewPanel key={s.id} id={s.id}><PanelBody title={s.title} body={s.body} /></TabViewPanel>)}
        </TabViewPanels>
        <div className="order-1 flex shrink-0 items-center gap-3 px-4 pt-3 shadow-[inset_0_-1px_0_var(--border)]">
          <span className="text-[15px] font-bold text-foreground">Address Book</span>
          <TabViewBar variant="plain">
            <TabViewList aria-label="Sections" className="gap-1">
              {sections.map((s) => (
                <TabViewTab key={s.id} id={s.id} className="relative px-3 py-2 text-[14px] font-semibold text-tertiary-foreground data-selected:text-primary">
                  {s.title}
                  <TabViewIndicator />
                </TabViewTab>
              ))}
            </TabViewList>
          </TabViewBar>
        </div>
      </TabView>
    </Panel>
  ),
};

/* ── Workspace rail: the chat kit's rail as a `workspace` bar ── */
const workspaces = [
  { id: 'blui', label: 'T', color: '#0A84FF', title: 'BL UI HQ' },
  { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery', unread: true },
  { id: 'labs', label: 'L', color: '#32D74B', title: 'Labs', mentions: 4 },
  { id: 'ops', label: 'O', color: '#FF9F0A', title: 'Ops', unread: true, mentions: 12 },
];
/** The direct-messages glyph (the chat icon set's `dm`), drawn with Icon. */
const DM_SHAPE = [{ d: 'M12 4.5c4.7 0 8.5 3 8.5 6.8s-3.8 6.8-8.5 6.8c-1 0-1.9-.1-2.8-.4L5 19.5l1.1-3.4C4.5 14.9 3.5 13.2 3.5 11.3c0-3.8 3.8-6.8 8.5-6.8z' }];

/** Discord's tile: a circle at rest that morphs to a rounded square when hovered or selected (filling with its
    color), with a mention badge. Styled from the tab's state through `group-data-*`. */
function WorkspaceTile({ color = 'var(--primary)', mentions, children }: { color?: string; mentions?: number; children: ReactNode }) {
  return (
    <span style={{ '--tile': color } as CSSProperties}
      className="relative box-border grid size-[34px] shrink-0 place-items-center rounded-[17px] border-2 border-transparent bg-secondary-strong font-ios text-[14px] leading-[normal] font-extrabold text-secondary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),border-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-data-hovered:rounded-[11px] group-data-selected:rounded-[11px] group-data-selected:border-(--tile) group-data-selected:bg-(--tile) group-data-selected:text-white group-data-pressed:scale-[.94] motion-reduce:transition-none group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-link">
      {children}
      {mentions ? (
        <span className="absolute -right-[7px] -bottom-[6px] box-border flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[3px] border-muted bg-destructive px-[3px] font-ios text-[10px] leading-none font-bold text-white">
          {mentions > 99 ? '99+' : mentions}
        </span>
      ) : null}
    </span>
  );
}

function WorkspaceRailDemo() {
  return (
    <TabView orientation="vertical" defaultSelectedKey="blui" className="flex h-full">
      <TabViewBar variant="workspace">
        <TabViewList aria-label="Workspaces">
          <TabViewTab id="home" textValue="Direct Messages">
            <TabViewIndicator variant="pill" />
            <WorkspaceTile mentions={2}><Icon shapes={DM_SHAPE} size={17} sw={2} /></WorkspaceTile>
          </TabViewTab>
          <TabViewSeparator />
          {workspaces.map((w) => (
            <TabViewTab key={w.id} id={w.id} textValue={w.title}>
              <TabViewIndicator variant="pill" attention={w.unread} />
              <WorkspaceTile color={w.color} mentions={w.mentions}>{w.label}</WorkspaceTile>
            </TabViewTab>
          ))}
        </TabViewList>
        <TabViewFooter>
          <TabViewAction aria-label="Add workspace" icon="plus" />
        </TabViewFooter>
      </TabViewBar>
    </TabView>
  );
}

/** The workspace switcher (was the chat kit's `WorkspaceRail`): a vertical TabView with `TabViewBar
    variant="workspace"` in the chat scope. Home is the first tab over a separator; tiles are custom tab content
    with the leading-edge `pill` indicator (a nub for unread, taller on hover, full when selected) and mention
    badges; "Add workspace" is a `TabViewAction` in the footer, which follows the list — the list scrolls once
    the tiles outgrow the rail. Up/Down move between tiles; the separator and the action are skipped. */
export const WorkspaceRail: Story = {
  args: { dark: true },
  render: ({ dark }) => (
    <ThemeScope scope="chat" appearance={dark ? 'dark' : 'light'} className="flex h-[480px] w-[200px] overflow-hidden bg-background text-foreground">
      <WorkspaceRailDemo />
    </ThemeScope>
  ),
};

export const WorkspaceRailLight: Story = { ...WorkspaceRail, args: { dark: false } };

/** More tiles than room: the list scrolls between the header and the footer. */
export const WorkspaceRailScrolling: Story = {
  render: () => (
    <ThemeScope scope="chat" appearance="dark" className="flex h-[300px] w-[200px] overflow-hidden bg-background text-foreground">
      <TabView orientation="vertical" defaultSelectedKey="w0" className="flex h-full">
        <TabViewBar variant="workspace">
          <TabViewHeader className="font-ios text-[10px] font-bold tracking-[.4px] text-tertiary-foreground uppercase">Chat</TabViewHeader>
          <TabViewList aria-label="Workspaces">
            {Array.from({ length: 12 }, (_, i) => (
              <TabViewTab key={i} id={`w${i}`} textValue={`Workspace ${i + 1}`}>
                <TabViewIndicator variant="pill" />
                <WorkspaceTile color={workspaces[i % 4].color}>{String.fromCharCode(65 + i)}</WorkspaceTile>
              </TabViewTab>
            ))}
          </TabViewList>
          <TabViewFooter>
            <TabViewAction aria-label="Add workspace" icon="plus" />
          </TabViewFooter>
        </TabViewBar>
      </TabView>
    </ThemeScope>
  ),
};

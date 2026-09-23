import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  TabView, TabViewAction, TabViewBar, TabViewFooter, TabViewHeader, TabViewIndicator, TabViewList, TabViewPanel,
  TabViewPanels, TabViewSeparator, TabViewTab, type TabViewPlacement,
} from './tab-view';
import { Icon } from '../lib/icon';
import { BLProvider } from '../lib/theme';
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
      <div className="text-[22px] font-bold tracking-[-.3px] text-bl-label">{title}</div>
      <div className="text-[14px] text-bl-label2">{body}</div>
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
      <TabView placement={placement} defaultSelectedKey="recents" className="absolute inset-0 bg-bl-bg">
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
            <TabViewAction aria-label="Account" className="grid size-9 place-items-center rounded-full bg-bl-fill2 text-[13px] font-bold text-bl-label2 data-hovered:bg-bl-fill">
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
      className="relative box-border grid size-10 place-items-center rounded-[14px] bg-bl-fill2 text-[14px] font-extrabold text-bl-label transition-[border-radius,background-color,color] duration-200 ease-ios group-data-hovered:rounded-[12px] group-data-selected:rounded-[12px] group-data-selected:bg-(--tile) group-data-selected:text-white group-data-hovered:bg-(--tile) group-data-hovered:text-white group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-primary">
      {children}
      {!!badge && (
        <span className="absolute -right-1.5 -bottom-1 box-border flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-[3px] border-bl-bg2 bg-destructive px-[3px] text-[10px] leading-none font-bold text-white">
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
      <TabView orientation="vertical" selectedKey={sel} onSelectionChange={(k) => setSel(String(k))} className="absolute inset-0 bg-bl-bg">
        <TabViewBar variant="plain" className="w-[64px] items-center gap-2 bg-bl-bg2 py-3 [border-right:1px_solid_var(--bl-sep)]">
          <TabViewList aria-label="Servers" className="w-full items-center gap-2">
            <TabViewTab id="home" textValue="Direct Messages" className="group flex w-full justify-center">
              <TabViewIndicator variant="pill" className="h-0 data-hovered:h-4 data-selected:h-8" />
              <RailTile color="var(--bl-tint)"><Icon name="message" size={20} /></RailTile>
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
            className="group grid size-10 place-items-center rounded-[14px] bg-bl-fill2 text-[#32D74B] transition-[border-radius,background-color,color] duration-200 ease-ios data-hovered:rounded-[12px] data-hovered:bg-[#32D74B] data-hovered:text-white">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5.5v13M5.5 12h13" /></svg>
          </TabViewAction>
        </TabViewBar>
        <div className="box-border flex min-w-0 flex-1 flex-col gap-1.5 p-6">
          <div className="text-[22px] font-bold tracking-[-.3px] text-bl-label">{current}</div>
          <div className="text-[14px] text-bl-label2">Up/Down arrows move between servers; the separator and the add button aren’t tabs.</div>
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
      <TabView placement="top" defaultSelectedKey="unread" className="absolute inset-0 bg-bl-bg">
        <TabViewBar variant="plain" className="gap-1 px-4 pt-3 shadow-[inset_0_-1px_0_var(--bl-sep)]">
          <TabViewList aria-label="Inbox filters" className="gap-1">
            {filters.map((f) => (
              <TabViewTab key={f.id} id={f.id} textValue={f.title} className="group px-2.5 pt-1.5 pb-3">
                {({ isSelected }) => (
                  <>
                    <span className={cn('flex items-center gap-1.5 text-[14px] font-semibold transition-colors duration-150',
                      isSelected ? 'text-bl-label' : 'text-bl-label3 group-data-hovered:text-bl-label2')}>
                      {f.title}
                      <span className={cn('rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums',
                        isSelected ? 'bg-primary text-white' : 'bg-bl-fill text-bl-label2')}>{f.count}</span>
                    </span>
                    <TabViewIndicator className="inset-x-2.5" />
                  </>
                )}
              </TabViewTab>
            ))}
          </TabViewList>
          <TabViewFooter>
            <TabViewAction aria-label="Filter settings" className="grid size-8 place-items-center rounded-lg text-bl-label3 data-hovered:bg-bl-fill">
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

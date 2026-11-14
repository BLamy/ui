import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import { List, ListRow, ListSection } from '@/components/ui/list';
import {
  NavigationStack, NavigationStackBar, NavigationStackContent, NavigationStackLargeTitle, NavigationStackPage,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack';
import { Tabs, TabsBar, TabsList, TabsTab } from '@/components/ui/tabs';
import { Phone } from '../stories/frame';

const meta: Meta<typeof NavigationStack> = {
  title: 'Organisms/NavigationStack',
  component: NavigationStack,
  decorators: [(Story, ctx) => <Phone dark={!!ctx.parameters.dark}><Story /></Phone>],
};
export default meta;
type Story = StoryObj<typeof NavigationStack>;

const PEOPLE: [string, string, string][] = [
  ['Amelia', 'Adler', 'Producer · Northlake Studio'],
  ['Wei', 'Chen', 'iOS Engineer · Parallel'],
  ['Anya', 'Kowalski', 'Climbing Coach · Boulder Barn'],
  ['Hana', 'Sato', 'Animator · Pixelfold'],
];

/** A page with a bar title and content, the shape most of these stories use. */
function Simple({ value, title, grouped, large, showOnScroll, hideOnScroll, bottomInset, onRefresh, children }: {
  value: string; title: ReactNode; grouped?: boolean; large?: boolean; showOnScroll?: boolean; hideOnScroll?: boolean;
  bottomInset?: number; onRefresh?: () => unknown; children: ReactNode;
}) {
  return (
    <NavigationStackPage value={value} grouped={grouped}>
      <NavigationStackBar hideOnScroll={hideOnScroll}>
        <NavigationStackTitle showOnScroll={showOnScroll}>{title}</NavigationStackTitle>
      </NavigationStackBar>
      <NavigationStackContent bottomInset={bottomInset} onRefresh={onRefresh}>
        {large ? <NavigationStackLargeTitle /> : null}
        {children}
      </NavigationStackContent>
    </NavigationStackPage>
  );
}

function Demo({ safeTop, withRefresh }: { safeTop?: boolean; withRefresh?: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const person = sel == null ? null : PEOPLE[sel];
  return (
    <NavigationStack pages={person ? ['list', 'detail'] : ['list']} onPagesChange={(p) => { if (p.length < 2) setSel(null); }}
      safeTop={safeTop ? 59 : undefined}>
      <Simple value="list" title="Contacts" large onRefresh={withRefresh ? () => undefined : undefined}>
        <List>
          <ListSection sticky title="Team">
            {PEOPLE.map(([f, l, role], i) => (
              <ListRow key={f} title={f + ' ' + l} description={role} icon={<Avatar name={`${f} ${l}`} />}
                accessory="chevron" onClick={() => setSel(i)} divider={i < PEOPLE.length - 1} />
            ))}
          </ListSection>
        </List>
      </Simple>
      {person ? (
        <Simple value="detail" title={person[0] + ' ' + person[1]} showOnScroll grouped>
          <div style={{ padding: '0 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 18px' }}>
              <Avatar name={`${person[0]} ${person[1]}`} size={92} />
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 12, letterSpacing: '-.3px' }}>{person[0]} {person[1]}</div>
              <div style={{ fontSize: 14.5, color: 'var(--muted-foreground)', marginTop: 3 }}>{person[2]}</div>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--muted-foreground)', padding: '0 2px' }}>
              Pop with the back button, an edge-swipe from the left, or Esc.
            </div>
          </div>
        </Simple>
      ) : null}
    </NavigationStack>
  );
}

export const PushPop: Story = { render: () => <Demo /> };
export const WithPullToRefresh: Story = { render: () => <Demo withRefresh /> };
export const WithSafeTop: Story = { render: () => <Demo safeTop /> };

const tallRows = (n = 40) => (
  <List>
    <ListSection sticky title="Scroll me">
      {Array.from({ length: n }, (_, i) => (
        <ListRow key={i} title={'Row ' + (i + 1)} description="Keep scrolling — the chrome rides away"
          divider={i < n - 1} />
      ))}
    </ListSection>
  </List>
);

/** `showOnScroll`: the bar title only fades in once the content scrolls (detail-page pattern),
 *  vs a large title, where the big in-content title hands off to the bar. */
export const TitleOnScroll: Story = {
  render: () => (
    <NavigationStack defaultPages={['tos']}>
      <Simple value="tos" title="Wei Chen" showOnScroll grouped>{tallRows(30)}</Simple>
    </NavigationStack>
  ),
};

/** Chrome hide-on-scroll: scroll down and the nav bar and the tab bar ride away together (chromeStore);
 *  scroll up — or back near the top — and they return. Sticky headers follow the bar. */
export const ChromeHideOnScroll: Story = {
  render: function ChromeHideStory() {
    const [tab, setTab] = useState('contacts');
    return (
      <>
        <NavigationStack defaultPages={['hide']}>
          <Simple value="hide" title="Contacts" large bottomInset={66}>{tallRows(60)}</Simple>
        </NavigationStack>
        <Tabs variant="bar" value={tab} onValueChange={(next) => { if (next) setTab(next); }} className="contents">
          <TabsBar>
            <TabsList aria-label="Tabs">
              <TabsTab value="contacts" icon="person">Contacts</TabsTab>
              <TabsTab value="settings" icon="sliders">Settings</TabsTab>
            </TabsList>
          </TabsBar>
        </Tabs>
      </>
    );
  },
};

/** `hideOnScroll={false}` on the bar keeps it pinned no matter how far you scroll. */
export const ChromeHideDisabled: Story = {
  render: () => (
    <NavigationStack defaultPages={['pinned']}>
      <Simple value="pinned" title="Pinned Chrome" large hideOnScroll={false}>{tallRows(60)}</Simple>
    </NavigationStack>
  ),
};

/** Dynamic Island + chrome hide: the bar collapses to the safe-area strip and no further —
 *  the opaque under-island strip never goes away. */
export const ChromeHideWithSafeTop: Story = {
  render: () => (
    <NavigationStack safeTop={59} defaultPages={['island']}>
      <Simple value="island" title="Contacts" large>{tallRows(60)}</Simple>
    </NavigationStack>
  ),
};

/* ── Back label and header title morph ── */

const settingsRows = (items: string[], open?: (s: string) => void) => (
  <List variant="inset">
    <ListSection>
      {items.map((t, i) => (
        <ListRow key={t} title={t} accessory={open ? 'chevron' : undefined} onClick={open ? () => open(t) : undefined}
          divider={i < items.length - 1} />
      ))}
    </ListSection>
  </List>
);

/** Push Settings → General → About: the large title flies into the next page's back button, and an inline
 *  title does the same one level down; popping (button, Esc or edge swipe) flies the label back into place.
 *  The edge swipe scrubs the morph with the finger. */
export const HeaderTitleMorph: Story = {
  render: function HeaderTitleMorphStory() {
    const [path, setPath] = useState<string[]>([]);
    const push = (k: string) => setPath((p) => [...p, k]);
    return (
      <NavigationStack pages={['settings', ...path]} onPagesChange={(p) => setPath(p.slice(1))}>
        <Simple value="settings" title="Settings" large grouped>
          {settingsRows(['General', 'Accessibility', 'Privacy & Security'], push)}
        </Simple>
        {path.map((k, i) => (
          <Simple key={k} value={k} title={k} grouped>
            {settingsRows(i === 0 ? ['About', 'Software Update', 'AirDrop'] : ['Name', 'iOS Version', 'Model Name'],
              i === 0 ? push : undefined)}
          </Simple>
        ))}
      </NavigationStack>
    );
  },
};

function Deep({ prev, title }: { prev: string; title: string }) {
  return (
    <NavigationStack defaultPages={['a', 'b']}>
      <Simple value="a" title={prev} grouped>{settingsRows(['One'])}</Simple>
      <Simple value="b" title={title} grouped>{settingsRows(['Detail'])}</Simple>
    </NavigationStack>
  );
}

/** The back label is the previous page's title when it fits beside the centered title… */
export const BackLabelFits: Story = { render: () => <Deep prev="Settings" title="General" /> };
/** …ellipsized when it doesn't (measured, not a character count)… */
export const BackLabelTruncated: Story = { render: () => <Deep prev="Notifications and Focus" title="Scheduled Summary" /> };
/** …"Back" when only a sliver is left, and just the chevron when "Back" doesn't fit either. */
export const BackLabelFallback: Story = {
  render: () => <Deep prev="Accessibility Shortcuts" title="Background Sounds While Playing" />,
};
export const BackLabelTruncatedDark: Story = {
  render: () => <Deep prev="Notifications and Focus" title="Scheduled Summary" />,
  parameters: { dark: true },
};

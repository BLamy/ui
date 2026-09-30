import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import { List } from '@/components/ui/list';
import { NavigationStack, type Screen } from '@/components/ui/navigation-stack';
import { TabBar } from '@/components/ui/tab-bar';
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

function Demo({ safeTop, withRefresh }: { safeTop?: boolean; withRefresh?: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const root: Screen = {
    key: 'list', title: 'Contacts', largeTitle: true,
    onRefresh: withRefresh ? () => undefined : undefined,
    content: (
      <List>
        <List.Section sticky title="Team">
          {PEOPLE.map(([f, l, role], i) => (
            <List.Row key={f} title={f + ' ' + l} subtitle={role} leading={<Avatar c={{ f, l }} />}
              accessory="chevron" onPress={() => setSel(i)} divider={i < PEOPLE.length - 1} />
          ))}
        </List.Section>
      </List>
    ),
  };
  const detail: Screen | null = sel == null ? null : {
    key: 'detail', title: PEOPLE[sel][0] + ' ' + PEOPLE[sel][1], titleOnScroll: true, grouped: true,
    content: (
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 18px' }}>
          <Avatar c={{ f: PEOPLE[sel][0], l: PEOPLE[sel][1] }} size={92} />
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 12, letterSpacing: '-.3px' }}>{PEOPLE[sel][0]} {PEOPLE[sel][1]}</div>
          <div style={{ fontSize: 14.5, color: 'var(--muted-foreground)', marginTop: 3 }}>{PEOPLE[sel][2]}</div>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--muted-foreground)', padding: '0 2px' }}>
          Pop with the back button, an edge-swipe from the left, or Esc.
        </div>
      </div>
    ),
  };
  return (
    <NavigationStack screens={[root, ...(detail ? [detail] : [])]} onPop={() => setSel(null)} safeTop={safeTop ? 59 : undefined} />
  );
}

export const PushPop: Story = { render: () => <Demo /> };
export const WithPullToRefresh: Story = { render: () => <Demo withRefresh /> };
export const WithSafeTop: Story = { render: () => <Demo safeTop /> };

const tallRows = (n = 40) => (
  <List>
    <List.Section sticky title="Scroll me">
      {Array.from({ length: n }, (_, i) => (
        <List.Row key={i} title={'Row ' + (i + 1)} subtitle="Keep scrolling — the chrome rides away"
          divider={i < n - 1} />
      ))}
    </List.Section>
  </List>
);

/** `titleOnScroll`: the bar title only fades in once the content scrolls (detail-screen pattern),
 *  vs `largeTitle` where the big in-content title hands off to the bar. */
export const TitleOnScroll: Story = {
  render: () => (
    <NavigationStack onPop={() => undefined} screens={[{
      key: 'tos', title: 'Wei Chen', titleOnScroll: true, grouped: true,
      content: tallRows(30),
    }]} />
  ),
};

/** Chrome hide-on-scroll: scroll down and the nav bar and TabBar ride away together (chromeStore);
 *  scroll up — or back near the top — and they return. Sticky headers follow the bar. */
export const ChromeHideOnScroll: Story = {
  render: function ChromeHideStory() {
    const [tab, setTab] = useState('contacts');
    return (
      <>
        <NavigationStack onPop={() => undefined} screens={[{
          key: 'hide', title: 'Contacts', largeTitle: true, bottomInset: 66,
          content: tallRows(60),
        }]} />
        <TabBar selected={tab} onSelect={setTab} items={[
          { id: 'contacts', title: 'Contacts', icon: 'person' },
          { id: 'settings', title: 'Settings', icon: 'sliders' },
        ]} />
      </>
    );
  },
};

/** `hideChromeOnScroll: false` keeps the bar pinned no matter how far you scroll. */
export const ChromeHideDisabled: Story = {
  render: () => (
    <NavigationStack onPop={() => undefined} screens={[{
      key: 'pinned', title: 'Pinned Chrome', largeTitle: true, hideChromeOnScroll: false,
      content: tallRows(60),
    }]} />
  ),
};

/** Dynamic Island + chrome hide: the bar collapses to the safe-area strip and no further —
 *  the opaque under-island strip never goes away. */
export const ChromeHideWithSafeTop: Story = {
  render: () => (
    <NavigationStack safeTop={59} onPop={() => undefined} screens={[{
      key: 'island', title: 'Contacts', largeTitle: true,
      content: tallRows(60),
    }]} />
  ),
};

/* ── Back label and header title morph ── */

const settingsRows = (items: string[], open?: (s: string) => void) => (
  <List inset>
    <List.Section>
      {items.map((t, i) => (
        <List.Row key={t} title={t} accessory={open ? 'chevron' : undefined} onPress={open ? () => open(t) : undefined}
          divider={i < items.length - 1} />
      ))}
    </List.Section>
  </List>
);

/** Push Settings → General → About: the large title flies into the next screen's back button, and an inline
 *  title does the same one level down; popping (button, Esc or edge swipe) flies the label back into place.
 *  The edge swipe scrubs the morph with the finger. */
export const HeaderTitleMorph: Story = {
  render: function HeaderTitleMorphStory() {
    const [path, setPath] = useState<string[]>([]);
    const push = (k: string) => setPath((p) => [...p, k]);
    const screens: Screen[] = [
      { key: 'settings', title: 'Settings', largeTitle: true, grouped: true,
        content: settingsRows(['General', 'Accessibility', 'Privacy & Security'], push) },
      ...path.map((k, i): Screen => ({
        key: k, title: k, grouped: true,
        content: settingsRows(i === 0 ? ['About', 'Software Update', 'AirDrop'] : ['Name', 'iOS Version', 'Model Name'],
          i === 0 ? push : undefined),
      })),
    ];
    return <NavigationStack screens={screens} onPop={() => setPath((p) => p.slice(0, -1))} />;
  },
};

function Deep({ prev, title }: { prev: string; title: string }) {
  return (
    <NavigationStack onPop={() => undefined} screens={[
      { key: 'a', title: prev, grouped: true, content: settingsRows(['One']) },
      { key: 'b', title, grouped: true, content: settingsRows(['Detail']) },
    ]} />
  );
}

/** The back label is the previous screen's title when it fits beside the centered title… */
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

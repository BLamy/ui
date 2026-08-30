import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './avatar';
import { List } from './list';
import { NavigationStack } from './navigation-stack';
import { PillButton } from './pill-button';
import { SplitView } from './split-view';
import { Phone } from '../stories/frame';

const meta: Meta<typeof SplitView> = {
  title: 'Organisms/SplitView',
  component: SplitView,
};
export default meta;
type Story = StoryObj<typeof SplitView>;

const PEOPLE: [string, string][] = [['Amelia', 'Adler'], ['Wei', 'Chen'], ['Anya', 'Kowalski'], ['Hana', 'Sato']];

function Master({ onPick, sel }: { onPick: (i: number) => void; sel: number | null }) {
  return (
    <NavigationStack onPop={() => undefined} screens={[{
      key: 'list', title: 'Contacts', largeTitle: true,
      content: (
        <List>
          <List.Section sticky title="Team">
            {PEOPLE.map(([f, l], i) => (
              <List.Row key={f} title={f + ' ' + l} leading={<Avatar c={{ f, l }} size={34} />}
                selected={sel === i} onPress={() => onPick(i)} divider={i < PEOPLE.length - 1} />
            ))}
          </List.Section>
        </List>
      ),
    }]} />
  );
}

function Sidebar() {
  return (
    <div style={{ padding: '14px 12px', fontSize: 15 }}>
      <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 12 }}>TouchKit</div>
      {['All Contacts', 'Favorites', 'Recents'].map((t, i) => (
        <div key={t} style={{ padding: '8px 10px', borderRadius: 9, background: i === 0 ? 'var(--tk-press)' : 'transparent' }}>{t}</div>
      ))}
    </div>
  );
}

export const Regular: Story = {
  render: function RegularStory() {
    const [sel, setSel] = useState<number | null>(1);
    return (
      <Phone w={1024} h={600}>
        <SplitView wc="regular" sidebar={<Sidebar />} master={<Master sel={sel} onPick={setSel} />}
          detail={sel == null
            ? <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--tk-label2)' }}>No Contact Selected</div>
            : (
              <NavigationStack onPop={() => setSel(null)} screens={[{
                key: 'detail-' + sel, title: PEOPLE[sel][0] + ' ' + PEOPLE[sel][1], titleOnScroll: true, grouped: true, maxW: 640,
                content: (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 16px' }}>
                    <Avatar c={{ f: PEOPLE[sel][0], l: PEOPLE[sel][1] }} size={92} />
                    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 12 }}>{PEOPLE[sel][0]} {PEOPLE[sel][1]}</div>
                  </div>
                ),
              }]} />
            )} />
      </Phone>
    );
  },
};

export const CompactWithDrawer: Story = {
  render: function CompactStory() {
    const [sel, setSel] = useState<number | null>(null);
    const [drawer, setDrawer] = useState(false);
    return (
      <Phone w={390} h={720}>
        <SplitView wc="compact" sidebar={<Sidebar />} drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}
          master={
            <>
              <Master sel={sel} onPick={setSel} />
              <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
                <PillButton label="Open sidebar drawer" tone="soft" onPress={() => setDrawer(true)} />
              </div>
            </>
          } />
      </Phone>
    );
  },
};

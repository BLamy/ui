import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer, ComposerBump, ComposerBumpHandle, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerText } from '@/components/ui/composer/composer';
import { ComposerCards, ComposerMorphCard, ComposerQueue, type ComposerQueueItem } from '@/components/ui/composer/composer-cards';
import { WorkbenchTheme } from '@/components/ui/workbench-theme';
import { AppearanceProvider, type Appearance } from '@/lib/theme';

function Frame({ appearance = 'light', children }: { appearance?: Appearance; children: ReactNode }) {
  return (
    <AppearanceProvider value={appearance}>
      <WorkbenchTheme style={{ minHeight: 360, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ maxWidth: 520, width: '100%', margin: '0 auto' }}>{children}</div>
      </WorkbenchTheme>
    </AppearanceProvider>
  );
}

const meta: Meta = {
  title: 'Molecules/Composer Cards',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

const Card = ({ children }: { children: ReactNode }) => <div className="px-3 py-2 text-footnote text-foreground">{children}</div>;

function Body() {
  return (
    <ComposerCard>
      <ComposerInput placeholder="Ask anything…" />
      <ComposerFooter>
        <ComposerSpacer />
        <ComposerSend />
      </ComposerFooter>
    </ComposerCard>
  );
}

/** A card above and a card below, at rest: separate surfaces in the composer's own material. */
export const TopAndBottom: Story = {
  render: () => (
    <Frame>
      <Composer>
        <ComposerCards side="top">
          <ComposerMorphCard key="a">
            <Card>Connect Notion to search your workspace</Card>
          </ComposerMorphCard>
        </ComposerCards>
        <Body />
        <ComposerCards side="bottom">
          <ComposerMorphCard key="b">
            <Card>3 files and the open diff go with this message</Card>
          </ComposerMorphCard>
        </ComposerCards>
      </Composer>
    </Frame>
  ),
};

/** With a top bump, the cards come out of the bump and take its width and material. */
export const FromBump: Story = {
  render: () => (
    <Frame>
      <Composer>
        <ComposerCards side="top">
          <ComposerMorphCard key="1">
            <Card>Read the billing page</Card>
          </ComposerMorphCard>
          <ComposerMorphCard key="2">
            <Card>Found the usage endpoint</Card>
          </ComposerMorphCard>
        </ComposerCards>
        <ComposerBump side="top">
          <ComposerBumpHandle>
            <ComposerText className="text-foreground/70">Working · 2 of 3 steps</ComposerText>
          </ComposerBumpHandle>
        </ComposerBump>
        <ComposerCard size="lg">
          <ComposerInput placeholder="Ask anything…" />
          <ComposerFooter>
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </Frame>
  ),
};

const QUEUED: ComposerQueueItem[] = [
  { id: 'q1', markdown: 'Also update the tests for the billing page', attachments: [] },
  { id: 'q2', markdown: 'Then open a PR', attachments: [] },
];

/** Two messages queued during a reply: the oldest sits against the composer, the newer one beyond it. */
export const Queue: Story = {
  render: () => (
    <Frame>
      <Composer streaming>
        <ComposerQueue defaultItems={QUEUED} />
        <Body />
      </Composer>
    </Frame>
  ),
};

export const QueueDark: Story = {
  render: () => (
    <Frame appearance="dark">
      <Composer streaming>
        <ComposerQueue defaultItems={QUEUED} />
        <Body />
      </Composer>
    </Frame>
  ),
};

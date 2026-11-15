import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownView, type ReferenceNode } from '@/components/ui/markdown-view';
import { Panel, Caption } from '../stories/primitive-frame';
import { Phone } from '../stories/frame';

const meta: Meta<typeof MarkdownView> = {
  title: 'Molecules/MarkdownView',
  component: MarkdownView,
  args: { streaming: false },
  decorators: [
    (Story, ctx) =>
      ctx.parameters.phone ? (
        <Phone appearance={ctx.parameters.dark ? 'dark' : 'light'}>
          <div className="bl-scroll absolute inset-0 overflow-y-auto p-5"><Story /></div>
        </Phone>
      ) : (
        <Panel w={560} dark={ctx.parameters.dark}><Story /></Panel>
      ),
  ],
};
export default meta;
type Story = StoryObj<typeof MarkdownView>;

/* All of it a pure function of its arguments: no network, no live demos. */
const REPLY = `## Release checklist

The tray now **snaps** to its detents and follows *reduced motion*. Ask @maya about the springs, or see #credenza.

1. Flip the \`trayDrag\` flag
2. Run the visual tests
   - light and dark
   - the phone frame
3. Ship it

> Keep the release threshold at \`0.4\`: lower and a slow drag closes the tray.

\`\`\`ts
export const tray = { detents: [0.4, 1], threshold: 0.4 }
\`\`\`

| Detent | Height | Closes on |
| --- | --- | --- |
| peek | 40% | a flick down |
| full | 100% | a drag past 40% |

- [x] Snap detents
- [ ] Docs page`;

export const Default: Story = { args: { markdown: REPLY } };

export const Dark: Story = { args: { markdown: REPLY }, parameters: { dark: true } };

/** Half a reply, still arriving: the open code fence stays open and the region is busy. */
export const Streaming: Story = { args: { markdown: REPLY.slice(0, REPLY.indexOf('export const') + 18), streaming: true } };

/** Nothing yet renders nothing; a host shows its own placeholder. */
export const Empty: Story = {
  render: () => (
    <>
      <Caption>Empty markdown</Caption>
      <MarkdownView markdown="" className="min-h-6 rounded-ctl bg-secondary" />
    </>
  ),
};

/** Chip clicks come back through `onReferenceClick`, so the host never imports Docstream. */
export const References: Story = {
  render: function References() {
    const [picked, setPicked] = useState<ReferenceNode | null>(null);
    return (
      <>
        <MarkdownView
          markdown={'@maya shipped the tray drag in #credenza last week, and @jonas tuned the springs in #feedback.'}
          onReferenceClick={setPicked}
        />
        <Caption>{picked ? `Picked ${picked.kind} ${picked.label ?? picked.id}` : 'Press a chip'}</Caption>
      </>
    );
  },
};

export const PhoneFrame: Story = { args: { markdown: REPLY }, parameters: { phone: true } };

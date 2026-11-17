import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownView, type ReferenceNode } from '@/components/ui/markdown-view';
import { AUDIO_PLAYER_SOURCE } from '../stories/audio-player-machine';
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

/* A `capnp` fence that's a workerd config: the services it runs on a read-only CloudflareDiagram, what isn't one listed
   under it, and the source in a disclosure. The diagram loads from `@brett_lamy/ui/cloudflare` when it's first shown. */
const WORKERD = `A chat app's \`config.capnp\`:

\`\`\`capnp
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [ (name = "main", worker = .main), (name = "do-storage", disk = (path = "do-storage", writable = true)) ],
  sockets = [ (name = "http", address = "*:8080", http = (), service = "main") ],
);

const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ROOMS", durableObjectNamespace = "Room"), (name = "SESSIONS", kvNamespace = "sessions") ],
  durableObjectNamespaces = [ (className = "Room", uniqueKey = "rooms", enableSql = true) ],
  durableObjectStorage = (localDisk = "do-storage"),
);
\`\`\``;

export const WorkerdConfig: Story = { args: { markdown: WORKERD } };

export const WorkerdConfigDark: Story = { args: { markdown: WORKERD }, parameters: { dark: true } };

export const WorkerdConfigOnAPhone: Story = { args: { markdown: WORKERD }, parameters: { phone: true } };

/** A config that doesn't read says where, and its source is still a press away. */
export const WorkerdConfigUnreadable: Story = { args: { markdown: WORKERD.replace('enableSql = true) ],', 'enableSql = true ],') } };

/* An ```xstate fence: the machine on a read-only StateDiagram, as tall as it needs to be read whole (up to 70% of the viewport
   or 640 px; past that it opens on its top-start corner, or on where it starts when that can't be read with it, and pans).
   The diagram loads from `@brett_lamy/ui/state-diagram` when it's first shown. */
const XSTATE = `The audio player, as a machine:

\`\`\`xstate
${AUDIO_PLAYER_SOURCE}
\`\`\``;

export const XStateFence: Story = { args: { markdown: XSTATE } };

export const XStateFenceDark: Story = { args: { markdown: XSTATE }, parameters: { dark: true } };

/** In a phone's column it opens on where the machine starts. */
export const XStateFenceNarrow: Story = { args: { markdown: XSTATE }, parameters: { phone: true } };

/* ── GitBook blocks: what sets MarkdownView apart from plain Markdown, and what most often regresses ── */
const BLOCKS = `## Install

{% hint style="info" %}
**Heads up.** The tray snaps to its detents and follows reduced motion.
{% endhint %}

{% hint style="warning" %}
Lowering the threshold below \`0.4\` closes the tray on a slow drag, which most people read as a dismissal rather than a snap back.
{% endhint %}

{% hint style="danger" %}
This removes the old \`trayDrag\` flag.
{% endhint %}

{% hint style="success" %}
All visual tests pass.
{% endhint %}

{% tabs %}
{% tab title="npm" %}
\`\`\`bash
npm install @brett_lamy/ui
\`\`\`
{% endtab %}
{% tab title="pnpm" %}
\`\`\`bash
pnpm add @brett_lamy/ui
\`\`\`
{% endtab %}
{% tab title="Notes" %}
Plain text in a tab.
{% endtab %}
{% endtabs %}

{% stepper %}
{% step %}
### Flip the flag
Set \`trayDrag\` to true.
{% endstep %}
{% step %}
### Run the tests
Light, dark and the phone frame.
{% endstep %}
{% step %}
### Ship it
{% endstep %}
{% endstepper %}

<details>
<summary>Why a 0.4 threshold?</summary>

Below it a slow drag reads as a dismissal; above it a flick feels sticky.

</details>

\`\`\`ts title="tray.ts"
export const tray = { detents: [0.4, 1], threshold: 0.4 }
\`\`\`
`;

/** Hints of each style, tabs (a command and a plain tab), a stepper with headings, an expandable and a titled fence. */
export const Blocks: Story = { args: { markdown: BLOCKS } };
export const BlocksDark: Story = { args: { markdown: BLOCKS }, parameters: { dark: true } };
export const BlocksPhone: Story = { args: { markdown: BLOCKS }, parameters: { phone: true } };

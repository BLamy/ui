# MessageScroller

A chat transcript that anchors turns, follows a streaming reply, and never moves the reader against their intent (the shadcn `message-scroller` behaviors). Following the live edge is UI SDK's `createStickToBottom`; the turn anchoring is a primitive on top of it.

Use something else when: you want the whole thread with an empty state and a composer that flies to its dock ([Conversation](https://blamy.github.io/ui/#/conversation), whose `ConversationMessages` is this scroller); the list is not a conversation (a feed or a log of rows: [ScrollArea](https://blamy.github.io/ui/#/scroll-area) or [LogList](https://blamy.github.io/ui/#/log-list)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/message-scroller.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  MessageScroller, MessageScrollerItem,
} from '@/components/ui/message-scroller'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { MessageScroller, MessageScrollerItem } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
import { MessageScroller, MessageScrollerItem } from '@/components/ui/message-scroller'

<MessageScroller threadKey={thread.id} streaming={isStreaming}>
  {messages.map((m) => (
    <MessageScrollerItem key={m.id} value={m.id} anchor={m.role === 'user'}>
      <Message message={m} />
    </MessageScrollerItem>
  ))}
</MessageScroller>
```

Items can sit anywhere under the scroller (in a fragment, a wrapper `div`, a component of yours): the scroller reads them from the log after each render. [Conversation](https://blamy.github.io/ui/#/conversation)'s `UserMessage` and `AssistantMessage` are items already, so inside a scroller you write them directly.

## Behaviors

1. **Anchoring turns**: a newly appended anchor item scrolls near the top with a `peek` (52px) of the previous turn, so the reply has room to stream in below.
2. **Follow the live edge**: auto-scroll runs only while you're at the bottom. The reply grows into the reserved room without moving the view.
3. **Release on intent**: wheel up, touch drag, or PageUp/Home instantly stop following; new chunks land offscreen.
4. **Jump to latest**: the floating pill returns to the live edge and re-engages following; while streaming it widens to say so. It stays mounted and fades out when it isn't needed, `inert` so Tab skips it.
5. **Open at last anchor**: switching `threadKey` opens at the last anchor, not the absolute bottom, falling back to the end.
6. **New turns rise in**: items that arrive while a thread is open rise into place (an anchor up from the composer, a reply under it); the ones a thread opens with are simply there.

## Props

### MessageScroller

| Prop | Default | Effect |
| --- | --- | --- |
| `threadKey` | | Identifies the thread; changing it re-opens at the last anchor. |
| `streaming` | `false` | A reply is arriving: the log is `aria-busy` and the jump pill says "Streaming" while the reader is away. |
| `peek` | `52` | Pixels of the previous turn left showing above a new anchor. |
| `aria-label` / `aria-labelledby` | "Messages" | The scroll region's name: name each one when a page shows two transcripts. |
| `children` | | `MessageScrollerItem`s, or parts that render one. |

It takes the root `div`'s props (`className`, `style`, `ref`, `data-*`).

### MessageScrollerItem

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | a generated id | The item's id in the thread. |
| `anchor` | `false` | The item starts a turn: it scrolls near the top when it arrives. |

It takes a `div`'s props.

## Styling

The column is `--message-column-width` (780px) wide and centred, with `--message-gutter` (22px) at its sides. Set them on the scroller, or any ancestor, to fit a narrower or wider host:

```tsx
<MessageScroller style={{ '--message-gutter': '12px', '--message-column-width': '100%' } as React.CSSProperties}>…</MessageScroller>
```

The parts have `data-slot`s: `message-scroller`, `message-scroller-viewport` (with `data-resting` inside a peeking composer bump), `message-scroller-content`, `message-scroller-item` (with `data-anchor`), `message-scroller-jump` (`data-open` / `data-closed`) and `message-scroller-jump-button` (`data-streaming`).

## Accessibility

The viewport is a named, focusable scroll region (`role="region"`, `tabIndex=0`); the transcript is `role="log"` with `aria-relevant="additions"` and `aria-busy` while streaming. The jump button is named "Jump to latest", and "Streaming, jump to latest" while it shows "Streaming". Items use `content-visibility: auto` so long threads stay responsive. Reduced motion makes the jump instant and turns rise in without moving.

## Live examples

Send a few turns, then scroll up and send another: anchoring, release, and the jump pill.

{% demo src="message-scroller/turn-anchoring" %}

A reply streaming in. Scroll up and following lets go; the jump pill rises in and widens to say a reply is streaming. Tap it and the view glides back down, and any scroll catches it:

{% demo src="message-scroller/streaming-jump-pill" %}

Turns that arrive after a thread opens rise into place; the turns a thread opens with are simply there:

{% demo src="message-scroller/turns-rise" %}

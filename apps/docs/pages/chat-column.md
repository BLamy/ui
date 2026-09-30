# ChatColumn

The docked half of a chat: a bordered, card-coloured `aside` holding a transcript that scrolls above a pinned composer. It is only the frame. It brings no messages and no composer of its own, so you can put a [Conversation](https://blamy.github.io/ui/#/conversation), a plain list, or anything else in it. [FloatingChat](https://blamy.github.io/ui/#/floating-chat) is the same pair of regions floated over content, and [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container) switches between the two by width.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/chat-column.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ChatColumn, ChatColumnTranscript, ChatColumnComposer,
} from '@/components/ui/chat-column'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ChatColumn, ChatColumnTranscript, ChatColumnComposer,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
<div className="flex h-[560px]">
  <ChatColumn className="w-[320px] shrink-0" aria-label="Chat">
    <ChatColumnTranscript className="overflow-y-auto">…</ChatColumnTranscript>
    <ChatColumnComposer className="p-2">
      <Composer>…</Composer>
    </ChatColumnComposer>
  </ChatColumn>
  <main className="min-w-0 flex-1">…</main>
</div>
```

The column has no width and no height of its own. Give it a width (`w-[320px]`, or `flex-1` in a fixed-width parent) and put it in a flex row with a height. It is a flex column with `min-h-0`, so the transcript takes the remaining height and the composer stays at the bottom.

## A docked chat

The transcript fills the column and scrolls (`overflow-y-auto` added by the demo); the composer is pinned. The Composer sits in the `glass` [theme scope](https://blamy.github.io/ui/#/theming), as ArtifactChatContainer docks it.

{% demo src="chat-column/docked" %}

## Accessibility

The root is an `aside`, which is a `complementary` landmark: give it an `aria-label` ("Chat") so it is named in a screen reader's landmark list. Scrolling the transcript and the composer's own keyboard behavior come from whatever you put inside; add `role="log"` (or use [MessageScroller](https://blamy.github.io/ui/#/message-scroller), which has it) on a live transcript.

## Props

All three parts pass every other prop through to their element and merge `className` last with `cn`.

| Part | Element | Base classes |
| --- | --- | --- |
| `ChatColumn` | `aside` | `z-2 flex min-h-0 min-w-0 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)]` |
| `ChatColumnTranscript` | `div` | `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden` |
| `ChatColumnComposer` | `div` | `min-w-0 shrink-0` |

## Styling

The parts carry `data-slot="chat-column"`, `data-slot="chat-column-transcript"` and `data-slot="chat-column-composer"`. The column draws a right border; for a column on the right, use `className="border-r-0 border-l"`. The transcript is `overflow-hidden`, so add `overflow-y-auto` (or render a scroller inside it) for content that can grow. `ChatColumn` also keeps the class `ck-artifact-chat__chat` as a hook for hosts that restyle the docked column.

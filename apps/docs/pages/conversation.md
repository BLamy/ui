# Conversation

The parts of an agent thread, assembled by position. A `Conversation` starts empty: a greeting above a centred composer with suggestion chips under it. When the first message arrives the greeting leaves, the same composer flies down to its dock with the draft and focus intact, and the first turn rises in. From then on the messages live in a [MessageScroller](https://blamy.github.io/ui/#/message-scroller), and `UserMessage`, `AssistantMessage`, `WorkLog` and `ToolCall` are the pieces you put in it. Use it for a full-height chat column; for a docked or floating chat around other content, pair the transcript with [ChatColumn](https://blamy.github.io/ui/#/chat-column) or [FloatingChat](https://blamy.github.io/ui/#/floating-chat).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/conversation.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Conversation, ConversationMessages, UserMessage,
  AssistantMessage,
} from '@/components/ui/conversation'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Conversation, ConversationMessages, UserMessage,
  AssistantMessage,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

The parts read the Workbench palette, so render them inside a [WorkbenchTheme](https://blamy.github.io/ui/#/workbench-theme) (or a `workbench` theme scope). `MessageMarkdown` renders through `MarkdownView`, which uses docstream; the shadcn CLI adds it as a dependency.

## Anatomy

Keep the children in this order; the parts animate between the empty and the thread state by reading `empty`.

```tsx
<Conversation empty={turns.length === 0}>
  <ConversationEmpty>
    <ConversationGreeting title="What are we building?" />
  </ConversationEmpty>
  <ConversationMessages threadKey={thread.id} streaming={streaming}>
    {turns.map((t) => [
      <UserMessage key={`${t.id}-u`}>{t.prompt}</UserMessage>,
      <AssistantMessage key={`${t.id}-a`}>
        <WorkLog summary="Worked for 4s">
          <ToolCall icon="doc-text" title="Read" detail="src/app.tsx" />
        </WorkLog>
        <MessageMarkdown markdown={t.reply} streaming={t.streaming} />
      </AssistantMessage>,
    ])}
  </ConversationMessages>
  <ConversationComposer>
    <Composer onSubmit={send}>…</Composer>
  </ConversationComposer>
  <ConversationSuggestions>
    <Suggestion onPress={() => send('Draft a plan')}>Draft a plan</Suggestion>
  </ConversationSuggestions>
</Conversation>
```

`Conversation` is a `flex min-h-0 flex-1 flex-col` box, so put it in a column with a height (a panel, a card with a fixed height). Empty, it scrolls on its own and pads itself.

## An empty thread that becomes a chat

Press a suggestion or send a message. The reply streams with the typing dots first, then the text; **Start over** remounts the thread.

{% demo src="conversation/thread" %}

## Messages and the work log

`ConversationMessages` turns its keyed children into `MessageScroller` items: every child needs a `key` (it becomes the item id), and a `UserMessage` anchors the scroll by default, so a new turn lands near the top with the reply growing below it. Pass `anchor` to another message to change that. Switch `threadKey` to re-open at the last anchor, and `peek` sets how many pixels of the previous turn stay visible.

`WorkLog` is the collapsed "Worked for 1m 4s" row. With `ToolCall` children it is a disclosure button (`aria-expanded`) that springs open; with none it is static text. Each `ToolCall` is `done`, `running` (a pulsing dot) or `error`, with an optional `detail` and a `code` well. `MessageMarkdown` shows the typing dots while `streaming` is true and no text has arrived.

{% demo src="conversation/work-log" %}

A settled thread shows `SettledBanner` above its composer. The component does not track the settled state: pass `onUnsettle` and change your own state, typically also when the user sends.

## Accessibility

- The transcript is [MessageScroller](https://blamy.github.io/ui/#/message-scroller)'s labelled `role="log"` region, with `aria-busy` while `streaming`.
- `ConversationTyping` is `role="status"` with the label "Thinking".
- `WorkLog`, `Suggestion`, `SettledBanner`'s button and the composer's controls are react-aria buttons: Enter and Space press them, and they show a focus ring from the keyboard.
- Images on a `UserMessage` all get `alt="attachment"`; if the images matter, describe them in the message text.
- The composer keeps focus and its draft across the empty-to-thread move. Give the composer an accessible name of its own.

## Props

### Conversation

| Prop | Default | Effect |
| --- | --- | --- |
| `empty` | `false` | The empty state: the greeting and suggestions show around a centred composer, and the root scrolls. |
| `className` / `style` | | Merged onto the root. |

### ConversationMessages

| Prop | Default | Effect |
| --- | --- | --- |
| `threadKey` | | Identifies the thread; changing it re-opens the scroller at the last anchor. |
| `streaming` | | A reply is arriving: the scroller follows the live edge and shows its jump pill. |
| `peek` | `52` | Pixels of the previous turn left above a new anchor. |
| `children` | | Keyed message elements. A `UserMessage` anchors unless its `anchor` says otherwise. |

### Parts

| Part | Props | Notes |
| --- | --- | --- |
| `ConversationEmpty` | `className` | Content above the composer while empty; leaves upward when the thread starts. Holds at most 620px. |
| `ConversationGreeting` | `title`, `description`, `icon`, `className` | `icon` replaces the tinted asterisk tile. |
| `ConversationComposer` | `className`, `style` | The composer dock: 620px wide and centred while empty, 780px with padding in a thread. It animates between the two (skipped under reduced motion). |
| `ConversationSuggestions` | `className` | Wrapping row of chips under the empty composer. |
| `Suggestion` | `onPress`, `className` | One chip. |
| `UserMessage` | `images`, `anchor`, `className` | Right-aligned bubble up to 78% wide; `images` are URLs shown above it. No children and no text means no bubble. |
| `AssistantMessage` | `className` | Plain block for the reply, work log and markdown. |
| `MessageMarkdown` | `markdown`, `streaming` | Streaming Markdown, and the typing dots until the first token. |
| `ConversationTyping` | `className` | The three-dot wave. |
| `WorkLog` | `summary`, `defaultOpen`, `className` | Children are `ToolCall`s. |
| `ToolCall` | `title`, `detail`, `code`, `icon`, `status`, `className` | `status`: `done` (default, the `icon` or a check), `running`, `error`. |
| `SettledBanner` | `onUnsettle`, `title`, `description`, `className`, `style` | `onUnsettle` is required. |

## Styling

Every part has a `data-slot`: `conversation` (with `data-empty`), `conversation-empty`, `conversation-greeting`, `conversation-messages`, `conversation-composer`, `conversation-suggestions`, `suggestion`, `user-message`, `assistant-message`, `typing-indicator`, `work-log` (with `data-open`), `tool-call` (with `data-status`) and `settled-banner`. All take `className`, merged last with `cn`, so `className="max-w-[520px]"` overrides a part's width.

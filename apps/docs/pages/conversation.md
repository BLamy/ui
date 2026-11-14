# Conversation

An agent thread around one composer. A `Conversation` starts empty: the kit's [EmptyState](https://blamy.github.io/ui/#/empty-state) above a centred composer, with suggestion chips under it. When the first message arrives the empty state leaves, the same composer flies down to its dock with the draft and focus intact, and the first turn rises in. From then on the messages live in a [MessageScroller](https://blamy.github.io/ui/#/message-scroller), and `UserMessage`, `AssistantMessage`, `WorkLog` and `ToolCall` are the pieces you put in it.

Use something else when: you only need the transcript, without the empty state and the dock ([MessageScroller](https://blamy.github.io/ui/#/message-scroller)); the chat sits beside other content or floats over it ([ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container)); you are building the prompt box itself ([Composer](https://blamy.github.io/ui/#/composer)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/conversation.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Conversation, ConversationEmpty, ConversationMessages,
  ConversationComposer, UserMessage, AssistantMessage,
} from '@/components/ui/conversation'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Conversation, ConversationEmpty, ConversationMessages,
  ConversationComposer, UserMessage, AssistantMessage,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

The parts take their colors from the theme scope they are in (`chat`, `workbench`, or none), light or dark. `MessageMarkdown` renders through `MarkdownView`, which uses docstream; the shadcn CLI adds it as a dependency.

## Anatomy

Keep the children in this order; the parts animate between the empty and the thread state by reading `empty`.

```tsx
<Conversation empty={turns.length === 0}>
  <ConversationEmpty title="What are we building?" description="Ask anything about this workspace." />
  <ConversationMessages threadKey={thread.id} streaming={streaming}>
    {turns.map((t) => [
      <UserMessage key={`${t.id}-u`} attachments={t.files}>{t.prompt}</UserMessage>,
      <AssistantMessage key={`${t.id}-a`}>
        <WorkLog summary="Worked for 4s">
          <ToolCall icon="doc-text" title="Read" description="src/app.tsx" />
        </WorkLog>
        <MessageMarkdown markdown={t.reply} streaming={t.streaming} />
      </AssistantMessage>,
    ])}
  </ConversationMessages>
  <ConversationComposer>
    <Composer onSubmit={(markdown, files) => send(markdown, files)}>…</Composer>
  </ConversationComposer>
  <ConversationSuggestions>
    <Suggestion onClick={() => send('Draft a plan')}>Draft a plan</Suggestion>
  </ConversationSuggestions>
</Conversation>
```

`Conversation` is a `flex min-h-0 flex-1 flex-col` box, so put it in a column with a height (a panel, a card with a fixed height). Empty, it scrolls on its own and pads itself.

## An empty thread that becomes a chat

Press a suggestion or send a message. The reply streams with the typing dots first, then the text; **Start over** remounts the thread.

{% demo src="conversation/thread" %}

## Messages and the work log

`ConversationMessages` is a `MessageScroller` that fades in when the thread starts, and every `UserMessage` and `AssistantMessage` in it is a scroller item, wherever it sits (wrapped in a fragment, a `div` or a component of yours). A `UserMessage` anchors the scroll by default, so a new turn lands near the top with the reply growing below it; pass `anchor` to change that, and `value` to give a message a stable id of your own. Switch `threadKey` to re-open at the last anchor; `peek` sets how many pixels of the previous turn stay visible.

A `UserMessage` shows what the [Composer](https://blamy.github.io/ui/#/composer) sent with it: pass `onSubmit`'s attachments as `attachments`. Images are thumbnails named by their file name; other files are chips with their name and size.

`WorkLog` is the "Worked for 1m 4s" row. With `ToolCall` children it is a disclosure button (`aria-expanded`) whose panel springs open; with none it is static text, without a chevron. Each `ToolCall` is `done`, `running` (a pulsing dot) or `error`, with an optional `description` and a `code` well. `MessageMarkdown` shows the typing dots while `streaming` is true and no text has arrived.

{% demo src="conversation/work-log" %}

Product-specific rows above the composer (T3 Code's "This thread is settled" banner, a credit warning) are yours to compose inside `ConversationComposer`; the t3-clone block's `SettledBanner` is one.

## Accessibility

- The empty state's title is a heading (`h2`, or `headingLevel`), so a screen reader's heading list finds the prompt.
- The transcript is [MessageScroller](https://blamy.github.io/ui/#/message-scroller)'s labelled `role="log"` region (name it with `aria-label` when a page shows two), with `aria-busy` while `streaming`.
- `ConversationTyping` is `role="status"` with the label "Thinking"; a running tool call is an image named "Running", a failed one "Failed".
- `Suggestion` is the kit's Button, and `WorkLog` a UI SDK Collapsible: its summary row is the trigger, with `aria-expanded` and `aria-controls` on its panel.
- The composer keeps focus and its draft across the empty-to-thread move.

## Props

### Conversation

| Prop | Default | Effect |
| --- | --- | --- |
| `empty` | `false` | The empty state: the empty content and suggestions show around a centred composer, and the root scrolls. |

It takes the `div`'s props (`className`, `style`, `ref`, `aria-*`).

### ConversationEmpty

| Prop | Default | Effect |
| --- | --- | --- |
| `title` | | The prompt, drawn as the kit's `EmptyState` with the title as a heading. |
| `description` | | A line under it. |
| `icon` | the tinted asterisk tile | `null` shows none. |
| `action` | | A button (or a row of them) under the text. |
| `headingLevel` | `2` | The title's heading level. |
| `children` | | Anything else above the composer (after the EmptyState when both are given). |

It leaves upward when the thread starts, and is as wide as `--conversation-width` (620px).

### ConversationMessages

Takes [MessageScroller](https://blamy.github.io/ui/#/message-scroller)'s props: `threadKey`, `streaming`, `peek` (default `52`), `aria-label`, and the messages as children.

### Messages

| Part | Props | Notes |
| --- | --- | --- |
| `UserMessage` | `attachments`, `anchor` (default `true`), `value`, `div` props | Right-aligned bubble up to 78% wide, its attachments above it. No text means no bubble. |
| `AssistantMessage` | `anchor` (default `false`), `value`, `div` props | The reply: work log and markdown. |
| `MessageMarkdown` | `markdown`, `streaming` | Streaming Markdown, and the typing dots until the first token. |
| `ConversationTyping` | `div` props | The three-dot wave. |
| `WorkLog` | `summary`, `defaultOpen`, `open`, `onOpenChange(open, details)`, `className` | Children are `ToolCall`s; with none the row is static. |
| `ToolCall` | `title`, `description`, `code`, `icon`, `status`, `className` | `status`: `done` (default, the `icon` or a check), `running`, `error`. |

### Dock and chips

| Part | Props | Notes |
| --- | --- | --- |
| `ConversationComposer` | `div` props | The composer dock: `--conversation-width` (620px) and centred while empty, `--message-column-width` (780px) with `--message-gutter` in a thread. It animates between the two (skipped under reduced motion). |
| `ConversationSuggestions` | `div` props | Wrapping row of chips under the empty composer. |
| `Suggestion` | Button props (`onClick`, `disabled`…) | One chip: the kit's `outline` Button, small and round. |

## Styling

Every part has a `data-slot`: `conversation` (with `data-empty`), `conversation-empty`, `conversation-messages`, `conversation-composer`, `conversation-suggestions`, `user-message`, `assistant-message`, `typing-indicator`, `work-log` (with UI SDK's `collapsible` parts inside it, which carry `data-open` / `data-closed`) and `tool-call` (with `data-status`). Widths are CSS variables: set `--conversation-width`, `--message-column-width` and `--message-gutter` on the `Conversation` (or any ancestor) to fit it to its host. All parts take `className`, merged last with `cn`.

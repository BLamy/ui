# MessageScroller

A chat transcript scroller that ports the shadcn `message-scroller` behaviors: it anchors turns, follows streams, and never moves the reader against their intent.

## Installation

{% tabs sync="install" %}
{% tab title="npm" %}
{% tabs sync="pm" %}
{% tab title="pnpm" %}
```sh
pnpm add @brett_lamy/ui
```
{% endtab %}
{% tab title="npm" %}
```sh
npm install @brett_lamy/ui
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn add @brett_lamy/ui
```
{% endtab %}
{% tab title="bun" %}
```sh
bun add @brett_lamy/ui
```
{% endtab %}
{% endtabs %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { MessageScroller, WorkbenchTheme } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% tabs sync="pm" %}
{% tab title="pnpm" %}
```sh
pnpm dlx shadcn@latest add https://blamy.github.io/ui/r/message-scroller.json
```
{% endtab %}
{% tab title="npm" %}
```sh
npx shadcn@latest add https://blamy.github.io/ui/r/message-scroller.json
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn dlx shadcn@latest add https://blamy.github.io/ui/r/message-scroller.json
```
{% endtab %}
{% tab title="bun" %}
```sh
bunx --bun shadcn@latest add https://blamy.github.io/ui/r/message-scroller.json
```
{% endtab %}
{% endtabs %}

Adds `@/components/ui/message-scroller.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  MessageScroller, WorkbenchTheme,
} from '@/components/ui/message-scroller'
```
{% endtab %}
{% endtabs %}

```jsx
<MessageScroller
  threadKey={thread.id}
  streaming={isStreaming}
  items={msgs.map(m => ({
    id: m.id,
    anchor: m.role === 'user',     // rows that start a turn
    node: <Message m={m}/>
  }))}
/>
```

## Behaviors

1. **Anchoring turns** — a newly appended anchor row scrolls near the top with a ~52px peek of the previous turn, so the reply has room to stream in below.
2. **Follow the live edge** — auto-scroll runs only while you're at the bottom. The reply grows into the reserved room without moving the view.
3. **Release on intent** — wheel up, touch drag, or PageUp/Home instantly stop following; new chunks land offscreen.
4. **Jump to latest** — the floating pill returns to the live edge and re-engages following; while streaming it pulses.
5. **Open at last anchor** — switching threads opens at the last user message, not the absolute bottom, falling back to the end.

## Accessibility

The viewport is a labelled, focusable scroll region (`role="region"`, `tabIndex=0`); the transcript is `role="log"` with `aria-relevant="additions"` and `aria-busy` while streaming. Rows use `content-visibility: auto` so long threads stay responsive.

## Live examples

Send a few turns, then scroll up and send another — anchoring, release, and the jump pill:

{% demo src="message-scroller/turn-anchoring" %}

A reply streaming in. Scroll up and following lets go; the jump pill rises in and widens to say a reply is streaming. Tap it and the view glides back down on a spring — interruptible, so any scroll catches it:

{% demo src="message-scroller/streaming-jump-pill" %}

Turns that arrive after a thread opens rise into place (the user's up from the composer, the reply beneath it); the turns a thread opens with are simply there:

{% demo src="message-scroller/turns-rise" %}

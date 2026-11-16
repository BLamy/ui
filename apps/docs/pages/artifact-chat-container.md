# ArtifactChatContainer

The kit's chat shell: an agent chat beside the thing it works on (a document, a dashboard, a map, an app's page). On a wide container the chat is a **column docked beside the artifact**; on a compact one it **floats over the artifact** as a [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) whose foot is your `Composer` and whose body is the transcript: it rests on the composer (or peeks the newest replies), grows over the artifact with a drag of its cap, and folds into a FAB when dragged below rest. The transcript and the composer are rendered once and move between the two presentations, so a half-typed draft, the caret and a streaming reply survive the switch.

Use it when a chat and an artifact share a screen. For a chat that *is* the screen, compose [Conversation](https://blamy.github.io/ui/#/conversation) directly; for any other floating card over a page (an order tracker, a map panel, a dock), use [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet); for an inspector beside content, [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/artifact-chat-container.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ArtifactChatContainer, ArtifactChatContainerContent,
  ArtifactChatContainerChat, ArtifactChatContainerComposer,
} from '@/components/ui/artifact-chat-container'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ArtifactChatContainer, ArtifactChatContainerContent,
  ArtifactChatContainerChat, ArtifactChatContainerComposer,
} from '@brett_lamy/ui/artifact-chat-container'
```
{% endtab %}
{% endtabs %}

```tsx
import {
  ArtifactChatContainer, ArtifactChatContainerContent,
  ArtifactChatContainerChat, ArtifactChatContainerComposer,
} from '@/components/ui/artifact-chat-container'
import {
  Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSpacer, ComposerSend,
} from '@/components/ui/composer'

<ArtifactChatContainer working={busy} workingLabel="Updating the chart…">
  <ArtifactChatContainerContent><Artifact /></ArtifactChatContainerContent>
  <ArtifactChatContainerChat><Conversation /></ArtifactChatContainerChat>
  <ArtifactChatContainerComposer>
    <Composer onSubmit={send}>
      <ComposerCard>
        <ComposerInput placeholder="Do anything" />
        <ComposerFooter><ComposerSpacer /><ComposerSend /></ComposerFooter>
      </ComposerCard>
    </Composer>
  </ArtifactChatContainerComposer>
</ArtifactChatContainer>
```

The container fills its parent (`h-full w-full`): give the parent a size.

## Presentations

`presentation="auto"` (the default) reads the container's **own** width, not the viewport's: at `breakpoint` (760px) and above it docks the chat, below it floats it. The root carries `data-size-class` and `data-presentation`, and it is the size-class scope of what it renders, so dialogs and popovers opened inside with `presentation="auto"` follow it too. `presentation="split"` always docks; `presentation="floating"` always floats, the right choice for maps, canvases and other full-bleed artifacts. On a wide container the floating chat keeps the chat's width (`chatWidth`) and rests on the `chatSide` edge, as a Maps card does on an iPad, instead of stretching across the artifact; on a phone it spans the width.

Drag the width across the breakpoint: the column slides away, the composer flies to the floating sheet's foot and the artifact grows into the room, keeping the draft.

{% demo src="artifact-chat-container/resize-breakpoint" %}

{% demo src="artifact-chat-container/split-to-floating" %}

### Docked

The column is an `aside` landmark named by `chatLabel` ("Chat"), `chatWidth` wide (400px), on the `chatSide` edge: `start` (default) or `end`, for an assistant beside an app's page. The transcript fills it above the composer.

### Floating

The floating chat is a `FloatingSheet` (`variant="glass"` by default, `bodyAlign="end"` so the transcript grows upward out of the cap):

- **Rest.** With `peek={0}` it rests on the composer alone; a `peek` (px, or `'30%'` of the container) keeps the newest replies readable above it, fading at the top edge. A `Conversation` or `MessageScroller` in the Chat part sits at its newest line while the chat rests, and anchors new turns again once it grows.
- **Grow.** Drag the cap up, press it, or use the arrow keys on it: the transcript grows over the artifact and the container dims. `Escape` and a press on the scrim bring it back to rest. `open` / `defaultOpen` / `onOpenChange(open, details)` control it (`details.reason`: `swipe`, `handle-press`, `handle-key`, `escape-key`, `outside-press`, `imperative`).
- **Fold.** Drag it below rest and it folds into a FAB on the `fabSide` edge at `fabAlign` (bottom center by default), (on a wide container, the `chatSide` end of the bottom edge, where the chat rested; on a phone, the middle), with `fabIcon` as its face; the FAB, named "Open " + `chatLabel`, brings it back. `minimized` / `defaultMinimized` / `onMinimizedChange(minimized, details)` control it (`swipe`, `trigger-press`, `imperative`).
- **Scroll.** Resting on the composer alone, it slides away while the artifact scrolls down (or the shared chrome hides) and comes back on a scroll up; `hideOnScroll={false}` keeps it.

{% demo src="artifact-chat-container/floating-peek" %}

## Working

While `working` is true, the floating composer's card becomes a tappable status (`workingLabel`, "Working…"): the agent is busy, the artifact stays clear. Pressing the status, or growing the chat, brings the real composer back so the user can queue another request; the card stays mounted underneath, so nothing typed is lost. `composing` / `onComposingChange(composing, details)` control which one shows (`details.reason`: `trigger-press`, `handle-press`, `handle-key`, `swipe`, `imperative`); uncontrolled, work starting hides the composer and work stopping brings it back. Docked, the composer always shows.

## Appearance

`appearance` is the chat's colour scheme: `auto` (default) follows the page; `light` and `dark` put the bl-theme's `sheet` scope on the chat surfaces only (the docked column, the floating sheet) so the chat can disagree with the page (a dark chat over a light map). The artifact keeps the page's theme, and popups opened from the chat wear the chat's. The composer wears the `glass` scope in the same appearance. To put the artifact in the same scheme as the chat, scope the `ArtifactChatContainerContent` yourself (a `className` of `dark` / `light`, or a `ThemeScope` inside it). `variant` is the floating chat's look: `glass` (default) blurs the artifact behind it, `card` is the opaque surface (an opaque card).

## Resting, peeking and folding: the words

The shell's resting states have one meaning each. **Peek** is how much transcript stays visible above the resting composer (`peek`, here and on FloatingSheet; MessageScroller's own `peek` is the slice of the previous turn above a new anchor, a different thing). **Open** is the chat grown over the artifact. **Minimized** is the chat folded into its FAB (FloatingSheet's word; a Composer's own fold is `collapsed="fab"`). **Collapse** is the policy of how far a drag or a scroll may fold it (`collapse` on FloatingSheet and on Composer).

## Parts

| Part | Renders | Role |
| --- | --- | --- |
| `ArtifactChatContainer` | `div` | The root: the grid (docked) or the positioned box (floating). Takes every `div` prop. |
| `ArtifactChatContainerContent` | `div` | The artifact. Stays mounted, in place, across presentations; full-bleed and scrolling under the floating chat. Not a landmark: pass `role="main"` (or `role="region"` with an `aria-label`) when it is the page's main content. |
| `ArtifactChatContainerChat` | nothing in place | The transcript. Rendered once and moved between the column and the floating sheet's body. Make it a full-height flex column with the newest message at the bottom (a `Conversation` or `MessageScroller` is). |
| `ArtifactChatContainerComposer` | nothing in place | The `Composer`. Rendered once and moved between the bottom of the column and the floating sheet's foot, inside a `glass` theme scope. |

Write the three parts as direct children, in any order. React context reaches the Chat and Composer from where you write them, not from the dock they are shown in.

## Props

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `presentation` | `'auto' \| 'split' \| 'floating'` | `'auto'` | Docked, floating, or decided by the container's width. |
| `breakpoint` | `number` | `760` | Container width, px, below which `auto` floats the chat (the container's size class is `compact` under it). |
| `chatWidth` | `number \| string` | `400` | Width of the docked column, and of the floating chat on a wide container. |
| `chatSide` | `'start' \| 'end'` | `'start'` | The inline edge the docked column sits on. |
| `chatLabel` | `string` | `'Chat'` | Accessible name of the column, the floating sheet and (with "Open ") its FAB. |
| `open` / `defaultOpen` / `onOpenChange` | `boolean` / `boolean` / `(open, details) => void` | `false` | The floating chat grown over the artifact. |
| `minimized` / `defaultMinimized` / `onMinimizedChange` | `boolean` / `boolean` / `(minimized, details) => void` | `false` | The floating chat folded into its FAB. |
| `working` | `boolean` | `false` | The agent is working: the floating composer becomes a tappable status. |
| `workingLabel` | `ReactNode` | `'Working…'` | The status's text. |
| `composing` / `onComposingChange` | `boolean` / `(composing, details) => void` | `!working` | Whether the real composer shows while working. |
| `peek` | `number \| '${number}%'` | `0` | Transcript kept visible above the resting floating composer. |
| `gutter` | `number` | `12` | Inset of the floating chat from the container's edges. |
| `variant` | `'glass' \| 'card'` | `'glass'` | The floating chat's look: `card` is the opaque surface. |
| `appearance` | `'auto' \| 'light' \| 'dark'` | `'auto'` | The chat's colour scheme. |
| `fabSide` / `fabAlign` | `'top' \| 'bottom' \| 'start' \| 'end'` / `'start' \| 'center' \| 'end'` | `'bottom'` / the `chatSide` on a wide container, `'center'` on a phone | Where the FAB rests. |
| `fabIcon` | `ReactNode` | a sparkle | The FAB's face. |
| `hideOnScroll` | `boolean` | `true` | Hide the resting floating chat while the artifact scrolls down. |

## Hook

`useArtifactChatContainer()` reads the container from anything inside it (the transcript's own header, for example) and throws outside one: `{ sizeClass, presentation, open, setOpen, composing, setComposing, minimized, setMinimized }`. The setters take an optional `{ reason, event }` and go through the same callbacks, so a controlled host hears them, and return `false` when the change was canceled, like every kit setter; `open` is always false while docked.

```tsx
function TranscriptHeader() {
  const { presentation, setOpen } = useArtifactChatContainer()
  return presentation === 'floating' ? <Button onClick={() => setOpen(false)}>Collapse</Button> : null
}
```

## Accessibility

Docked, the chat is a named `complementary` landmark. Floating, it is a dialog named by `chatLabel`: at rest it is not modal and focus is never moved, so the artifact stays usable beside it; grown, it is modal to the container and `Escape` brings it back. The cap is UI SDK's drawer handle ("Expand" / "Collapse"; Enter, Space, the arrow keys, Home and End). The FAB is out of the tab order and the accessibility tree until the chat folds into it. The working status is one button named for what it does, "Write a message", with the status text (`workingLabel`) as its description. On a touch screen the 18px cap answers presses 44px tall over the transcript's faded top edge, and the padding around the floating composer passes presses through to it.

## Styling

The root carries `data-slot="artifact-chat-container"`, `data-presentation` (`split` / `floating`), `data-size-class`, `data-chat-side` and, for an explicit appearance, `data-appearance`; the docked aside and the floating sheet carry `data-theme-scope="sheet"` and the appearance class. Docked, `artifact-chat-column` holds the `artifact-chat-chat` aside with its `artifact-chat-transcript-dock` and `artifact-chat-composer-dock`; floating, the FloatingSheet's own slots (`floating-sheet`, `floating-sheet-body`, `floating-sheet-footer`) hold the same docks. The artifact is `artifact-chat-content`. `ck-artifact-chat`, `ck-artifact-chat__chat` and `ck-artifact-chat__content` stay as class hooks. `artifactChatContainerVariants({ presentation, chatSide })` is the root's recipe.

## Blocks built on it

- **[Map chat](https://blamy.github.io/ui/#/blocks/map-chat)**: `presentation="floating"` over a `TileMap`, with a `peek` so the guide's newest reply stays over the map, and tool calls that move the camera.

{% demo src="artifact-chat-container/map-chat" %}

- **[Loop QA](https://blamy.github.io/ui/#/blocks/loop-qa)**: an assistant docked on the `end` edge beside an app's pages, floating on a phone.
- **[Delivery tracking](https://blamy.github.io/ui/#/blocks/delivery-tracking)** is the same idea without a chat: a docked `FloatingSheet` over a map.

{% demo src="artifact-chat-container/delivery-tracking" %}

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `artifactChatContainerVariants`

Defined in `@/components/ui/artifact-chat-container`. Base classes:

```text
ck-artifact-chat relative isolate h-full w-full min-h-0 min-w-0 overflow-hidden bg-background font-sans text-foreground
```

**`presentation`** — default `split`

| Value | Adds |
| --- | --- |
| `split` (default) | `grid` |
| `floating` | `block` |

**`chatSide`** — default `start`

| Value | Adds |
| --- | --- |
| `start` (default) | — |
| `end` | — |

2 compound variants — see the source.

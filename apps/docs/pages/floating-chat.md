# FloatingChat

A chat that floats over any positioned host. Your [Composer](https://blamy.github.io/ui/#/composer) rests near the bottom on frosted glass (or an opaque card), and the transcript hangs off a draggable bump on top of it. Drag the grip up and the transcript grows to the top of the host over a dimming scrim; release snaps it open or closed. Drag down past rest and the whole chat folds into a round button. While an agent works the composer card collapses into a tappable status pill.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/floating-chat.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  FloatingChat, useFloatingChat,
} from '@/components/ui/floating-chat'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { FloatingChat, useFloatingChat } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

It is the floating half of [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container), and works on its own over a map, a dashboard or a scrolling page. It is not built on [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet): it puts a `ComposerBump` on top of the Composer you supply and reuses FloatingSheet's tone and the shared drag gesture (`useSheetDrag`). For the docked counterpart see [ChatColumn](https://blamy.github.io/ui/#/chat-column); for the transcript itself see [Conversation](https://blamy.github.io/ui/#/conversation).

## Usage

The host must be positioned (`relative`, `absolute`, …) and sized: `FloatingChat` fills it with a pointer-transparent layer, so the content behind stays usable.

```tsx
<div className="relative h-[520px] overflow-hidden">
  <Page ref={pageRef} />
  <FloatingChat scrollRef={pageRef}>
    <FloatingChat.Chat><Transcript /></FloatingChat.Chat>
    <FloatingChat.Composer>
      <Composer>…</Composer>
    </FloatingChat.Composer>
  </FloatingChat>
</div>
```

`FloatingChat.Chat` is the transcript (it fills the bump; make it a full-height flex column and put the newest message at the bottom) and `FloatingChat.Composer` is the composer, any [Composer](https://blamy.github.io/ui/#/composer) composition. The slots are markers: only their children are rendered, and other children of `FloatingChat` are ignored.

## Over a scrolling page

`hideOnScroll` (on by default) slides the composer away when the shared BL UI chrome hides or when `scrollRef`'s scroller moves down, and brings it back on the way up. It only applies while `peek` is `0`: a chat with a peeking transcript stays put. Scroll the page, then drag the grip up to open the transcript; switch the appearance to see glass and sheet.

{% demo src="floating-chat/over-a-page" %}

## Working status and the hook

With `working`, the composer card is replaced by a status pill (`workingLabel`) while the real card stays mounted underneath, so the draft is kept. Tapping the pill calls `onAdd` and brings the composer back; so does opening the chat. `composing` and `onComposingChange` control that visibility yourself.

`useFloatingChat()` reads the live state from inside either slot: `open`, `progress` (about 0 when only the composer floats to 1 fully open; it can overshoot 1 slightly while you drag), `composing`, `minimized` and their setters. It throws outside a `FloatingChat`. This demo prints it in the transcript, which `peek={88}` keeps partly visible; drag the grip to watch `progress`:

{% demo src="floating-chat/working" %}

## Open and minimized state

`open` / `defaultOpen` / `onOpenChange` control the revealed transcript, and `minimized` / `defaultMinimized` / `onMinimizedChange` the fold into the FAB. The FAB sits at `fabPosition` (`top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`); pressing it closes the chat and unfolds it. Opening the chat also unfolds it. Dragging below rest always offers the fold; there is no prop to turn it off.

## Accessibility

- The grip is a real button, named "Expand chat" or "Collapse chat", with `aria-expanded` and `aria-controls` pointing at the transcript. Enter and Space toggle it, and a plain tap anywhere on the handle row does too.
- The transcript is a labelled region; set `label` (default "Full chat"). Escape closes an open chat.
- The scrim is a button named "Close", mounted only while the chat is open or growing, and focusable only while open.
- The FAB is named "Open chat". The working pill has the visible `workingLabel` and an `sr-only` "Add something new".
- While minimized the dock is `inert` and `aria-hidden`.
- Dragging is a pointer affordance; keyboard users get the same result from the grip button.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange` | `false` | Controlled or uncontrolled transcript. |
| `working` | `false` | Collapses the composer card into the status pill. |
| `workingLabel` | `Working…` | Text of the pill. |
| `onAdd` | | Called when the pill is pressed, or the chat is opened while working. |
| `composing` / `onComposingChange` | `!working` | Whether the composer shows while `working`. Defaults to hiding it whenever work starts. |
| `peek` | `0` | Transcript height kept visible above the composer while closed, so the newest reply peeks out. While it is above 0 the chat does not hide on scroll. |
| `gutter` | `16` | Inset of the composer from the host edges, in px. |
| `appearance` | `glass` | `glass` blurs the host behind it; `sheet` uses opaque host-card surfaces. |
| `tone` | ambient, else `auto` | `auto` inherits the host's tokens; `light` or `dark` opens the `sheet` theme scope. The embedded composer is always in the `glass` scope, dark unless the tone is `light`. |
| `hideOnScroll` | `true` | Slide away when the shared chrome or `scrollRef` scrolls down. Does not hide while `peek` is above 0 or the transcript is open or growing. |
| `scrollRef` | | A scroller whose direction hides and restores the composer. |
| `fabPosition` | `bottom-center` | Where the folded FAB rests. |
| `minimized` / `defaultMinimized` / `onMinimizedChange` | `false` | The fold into the FAB. |
| `label` | `Full chat` | Accessible name of the transcript region. |
| `className` / `style` | | Merged onto the root layer. |

## Styling

The root is `data-slot="floating-chat"` with `data-appearance`, `data-tone` (unless `auto`), `data-open`, `data-expanded`, `data-dragging`, `data-minimized` and `data-hidden`. Its parts are `floating-chat-scrim`, `floating-chat-dock`, `floating-chat-composer`, `floating-chat-card`, `floating-chat-working`, `floating-chat-bump`, `floating-chat-transcript` and `floating-chat-fab`. `--ck-chat-gutter` and `--ck-chat-fold` (0 to 1 as it folds) are set on the root.

The transcript takes the host's palette back through `ck-floating-chat__transcript` (the glass composer scope would otherwise recolor it), so it reads the same `--background`, `--foreground` and `--muted-foreground` as the page around it. `FloatingChat.Context` and `FloatingChat.useFloatingChat` are also available as statics.

The recipes below are exported from the module file (`@/components/ui/floating-chat`); the npm package root does not re-export them.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `floatingChatVariants`

Defined in `@/components/ui/floating-chat`. Base classes:

```text
ck-floating-chat pointer-events-none absolute inset-0 z-40 text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]
```

**`tone`** — default `auto`

| Value | Adds |
| --- | --- |
| `auto` (default) | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `dark` | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `light` | `[--ck-sheet-line:0,0,0] [--ck-sheet-surface:250,250,252]` |

### `floatingChatBumpVariants`

Defined in `@/components/ui/floating-chat`. Base classes:

```text
ck-floating-chat__bump
```

**`appearance`** — default `glass`

| Value | Adds |
| --- | --- |
| `glass` (default) | `border-[color:rgba(var(--ck-sheet-line),.14)] bg-[color:rgba(var(--ck-sheet-surface),calc(.5_+_.4_*_var(--bump-progress,0)))] [box-shadow:inset_0_1px_0_color-m…` |
| `sheet` | `border-[color:rgba(var(--ck-sheet-line),.1)] bg-(--ck-host-card)` |

### `floatingChatFabVariants`

Defined in `@/components/ui/floating-chat`. Base classes:

```text
absolute border-[color:rgba(var(--ck-sheet-line),.14)] text-foreground
```

**`appearance`** — default `glass`

| Value | Adds |
| --- | --- |
| `glass` (default) | `bg-[color:rgba(var(--ck-sheet-surface),.62)]` |
| `sheet` | `bg-card` |

**`position`** — default `bottom-center`

| Value | Adds |
| --- | --- |
| `top-left` | `top-(--ck-chat-gutter) left-(--ck-chat-gutter)` |
| `top-center` | `top-(--ck-chat-gutter) left-1/2 -translate-x-1/2` |
| `top-right` | `top-(--ck-chat-gutter) right-(--ck-chat-gutter)` |
| `center-left` | `top-1/2 left-(--ck-chat-gutter) -translate-y-1/2` |
| `center-right` | `top-1/2 right-(--ck-chat-gutter) -translate-y-1/2` |
| `bottom-left` | `bottom-(--ck-chat-gutter) left-(--ck-chat-gutter)` |
| `bottom-center` (default) | `bottom-[max(var(--ck-chat-gutter),20px)] left-1/2 -translate-x-1/2` |
| `bottom-right` | `bottom-(--ck-chat-gutter) right-(--ck-chat-gutter)` |

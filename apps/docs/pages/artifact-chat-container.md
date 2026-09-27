# ArtifactChatContainer

A container-aware chat and artifact composition. At larger widths the full chat docks on the left and the artifact fills the right. Below the breakpoint, the artifact keeps the whole canvas and your Workbench `Composer` floats above it on frosted glass. The transcript hangs off a **draggable top bump** of that composer: pull the bump's handle upward and the conversation tracks the pointer, then snaps fully open or closed on release. Continue dragging below the closed position to fold the chat into a single FAB; tapping that FAB restores only the compact Composer.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx lineNumbers="false"
import '@brett_lamy/ui/styles.css'

import {
  ArtifactChatContainer, useArtifactChatContainer,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/artifact-chat-container.json{% endcommand %}

Adds `@/components/ui/artifact-chat-container.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx lineNumbers="false"
import {
  ArtifactChatContainer, useArtifactChatContainer,
} from '@/components/ui/artifact-chat-container'
```
{% endtab %}
{% endtabs %}

The floating half is not special to this container: it is the standalone `FloatingChat`, which adds a `ComposerBump side="top" draggable` (handle + `ComposerBumpContent` holding the transcript) to whatever Composer you put in the slot, through a `ComposerOutlet`. `ArtifactChatContainer` only decides *when* to float it.

```tsx
import {
  ArtifactChatContainer, Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSpacer, ComposerSend,
} from '@brett_lamy/ui'

<ArtifactChatContainer
  layout="auto"          // 'auto' | 'split' | 'floating'
  breakpoint={760}
  chatWidth={400}
  hideOnScroll
  fabPosition="bottom-center"
  working={isWorking}
  workingLabel="Working on the artifact…"
  onAdd={() => setIsWorking(false)}
>
  <ArtifactChatContainer.Chat><Conversation /></ArtifactChatContainer.Chat>
  <ArtifactChatContainer.Composer>
    <Composer onSubmit={send}>
      <ComposerCard>
        <ComposerInput placeholder="Do anything" />
        <ComposerFooter><ComposerSpacer /><ComposerSend /></ComposerFooter>
      </ComposerCard>
    </Composer>
  </ArtifactChatContainer.Composer>
  <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
</ArtifactChatContainer>
```

## Built from

| Piece | Role |
| --- | --- |
| `useContainerWidth` | Resolves `layout="auto"` from the container width. |
| `ChatColumn` | The split layout's docked chat: `ChatColumn.Transcript` scrolls above `ChatColumn.Composer`. |
| `FloatingChat` | The floating layout: the slot's Composer over the content, with the transcript on a draggable top bump (`ComposerOutlet` + `ComposerBump`). |

Each piece is exported from `@brett_lamy/ui`, so a layout the container does not offer can be composed directly.

## Responsive slots

| Slot | Split layout | Compact layout |
| --- | --- | --- |
| `Chat` | Full left column | Snaps into the full-page chat |
| `Composer` | Bottom of the chat column | Floating over the content; its top bump carries the transcript |
| `Content` | Right column | Full canvas scrolling behind the glass |

The breakpoint measures the container, not the viewport. A tap on the bump's handle toggles the two chat states; a drag previews the travel, then release settles fully open or fully closed. The scrim and `Escape` collapse the full chat. Dragging downward past the closed Composer minimizes it. `fabPosition` accepts `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, or `bottom-right`; the default is `bottom-center`. `chatOpen` / `onChatOpenChange` provide controlled chat state, and `useArtifactChatContainer()` exposes the measured width and presentation state to descendants.

## Layout, peek, and surface options

| Prop | Default | Effect |
| --- | --- | --- |
| `layout` | `auto` | `auto` splits above `breakpoint` and floats below it. `floating` always floats the chat over the content — the right choice for maps, canvases, and other full-bleed artifacts. `split` always docks. |
| `peek` | `0` | Height of transcript kept visible above the composer while the chat is closed, so the newest reply stays readable over the content. Growth is measured from the peek, so the glass keeps its compact shape until it is dragged past it. |
| `appearance` | `glass` | `glass` blurs the content behind it; `sheet` is an opaque card. |
| `tone` | `auto` | `auto` inherits the host's `--bl-*` tokens; `dark` and `light` override them so the surface can disagree with the page. |

## Working and scroll behavior

When `working` is true, the composer card becomes a translucent, tappable **Working…** bar (the outlet wraps the card; the bump stays). Tapping it reveals the real Composer so the user can add another request without leaving the artifact. Use `onAdd` to clear the working state, then set `working` again when the new request begins.

`hideOnScroll` defaults to true. The floating control follows both its own content scroller and the shared BL UI chrome state used by `TabBar` and `NavigationStack`: scrolling down hides it, scrolling up restores it. The artifact no longer reserves a white dock spacer; content continues behind the fixed glass. Expanded chat stays visible while scrolling.

The demo composes a trimmed Composer — editor, expand, attach, and send — without the model, effort, access, or checkout parts.

## Live example

Switch between split and floating layouts, flick the bump's handle to either snap state, then keep dragging downward to minimize the Composer into its FAB.

{% demo src="artifact-chat-container/split-to-floating" %}

## One chat, two layouts

The composer and the transcript are rendered once and moved between the docked column and the floating sheet, so crossing the breakpoint keeps a half-typed draft, the caret and a streaming reply. The composer flies from its old place to its new one; the column slides away (or in) while the artifact grows into the room. Type a draft, then drag the width:

{% demo src="artifact-chat-container/resize-breakpoint" %}

Always floating with a `peek`: the newest replies stay visible above the composer. Send something to see the working pill take the card's place; flick the grip up for the whole chat, or down past rest to fold it into the FAB (the chat shrinks toward where the FAB sits as the FAB grows out of it).

{% demo src="artifact-chat-container/floating-peek" %}

## Examples

Full compositions built on the container and its floating surface. Each links to a full-screen version.

### Map chat

A chat that is always floating over a map and works by calling tools. The composition is `ArtifactChatContainer layout="floating"` with a `TileMap` in the `Content` slot and a `peek` so the guide's newest reply stays visible above the composer. Drag the cap up for the full transcript; drag it below the composer to fold the chat into a FAB and use the map alone.

```tsx
import { ArtifactChatContainer, TileMap, planTurn } from '@brett_lamy/ui'

<ArtifactChatContainer layout="floating" peek={236} working={busy} hideOnScroll={false}>
  <ArtifactChatContainer.Content>
    <TileMap view={view} pins={pins} route={route} controls onPinClick={focusPlace} />
  </ArtifactChatContainer.Content>
  <ArtifactChatContainer.Chat><Transcript turns={turns} /></ArtifactChatContainer.Chat>
  <ArtifactChatContainer.Composer>
    <Composer onSubmit={send} streaming={busy} onStop={stop}>
      <ComposerCard><ComposerInput /><ComposerFooter><ComposerSpacer /><ComposerSend /></ComposerFooter></ComposerCard>
    </Composer>
  </ArtifactChatContainer.Composer>
</ArtifactChatContainer>
```

#### The tool loop

`planTurn(input, memory, userPosition)` is a scripted stand-in for a model: it reads the request, picks tool calls, and returns `{ steps, reply, memory }`. Each step is one of `search_places`, `show_on_map`, `plan_route`, `save_trip`, or `clear_map`, and runs against a `MapToolHost` the demo implements over its own state — the same interface a real agent backend would drive. Tool rows appear in the transcript as they run, then the reply streams in. Places in the reply are `@place` mention chips (tap to fly the camera), and `#category` / `#area` tags start a new search.

Try: *Coffee near me*, *Plan an afternoon in SoHo*, *How far is the Empire State Building?*, *Best pizza in the Village*.

#### TileMap

`TileMap` is a dependency-free slippy map: raster tiles at the nearest integer zoom scaled to the fractional camera, with pins and a route projected in an overlay. `view` accepts `{ center, zoom }` or `{ bounds, padding, maxZoom }` and flies to it whenever the object identity changes; gestures (drag, pinch, wheel, double-tap) move the camera without touching the prop. `tileUrl` swaps the tile set — key-free `esriDarkGrayTiles`, `esriLightGrayTiles`, and `osmTiles` are included, with `tileFilter` to deepen a grey basemap — and `scheme="light"` flips label and control colours to match. Pins take an icon, a colour, a numbered `badge`, or a `callout` bubble.

#### Live example

Tiles load from Esri, so this block needs network. Open it full screen at [`?demo=artifact-chat-container/map-chat`](?demo=artifact-chat-container/map-chat).

{% demo src="artifact-chat-container/map-chat" %}

### Delivery tracking

An order tracker in the style of a food-delivery app, composed from the same primitives as the map chat: a light `TileMap` underneath and an opaque, edge-docked `FloatingSheet` carrying the order status. Resting, the sheet shows the headline, a `ProgressStepper`, the pickup instructions, and a promo row; drag the cap and the same surface grows into the full page with gift-card and menu carousels.

```tsx
import { FloatingSheet, ProgressStepper, TileMap, esriLightGrayTiles } from '@brett_lamy/ui'

<div style={{ position: 'relative' }}>
  <TileMap view={route} pins={[store, car]} route={path} tileUrl={esriLightGrayTiles} scheme="light" />
  <FloatingSheet appearance="sheet" tone="light" gutter={0} radius={20} peek={344} bodyAlign="start" minimizable={false} scrim={false}>
    <FloatingSheet.Body>
      <h2>Preparing your order</h2>
      <ProgressStepper steps={steps} current={stage} />
      <PickupInstructions />
      <Disclosure title="Order details" />
      <Carousel title="Gift cards" />
    </FloatingSheet.Body>
  </FloatingSheet>
</div>
```

#### What is configurable

| Knob | Where | Effect |
| --- | --- | --- |
| `appearance`, `tone`, `gutter`, `radius` | `FloatingSheet` | Opaque card docked to the edges here; `glass` with a `gutter` turns the same tracker into a floating card over the map. |
| `peek`, `bodyAlign`, `minimizable` | `FloatingSheet` | How much rests over the map, which end of the body the window anchors to, and whether it can fold away. |
| `variant`, `animated`, `labels` | `ProgressStepper` | Segment bars or a joined line, an active shimmer, optional labels. Every step exposes `data-state="done|active|todo"`. |
| `scheme`, `tileUrl`, pin `callout` | `TileMap` | Light chrome over grey Esri tiles, and the ETA bubble on the car. |
| `stage`, `autoAdvance`, `stageMs`, `accent` | `DeliveryTrackingDemo` | Drive the order stage yourself or let it advance; recolour the stepper, pins, and primary button. |

The sheet body is ordinary content: the stepper, cards, disclosure, and carousels are siblings a host reorders or replaces. Nothing in it knows about the map.

#### Live example

Open it full screen at [`?demo=artifact-chat-container/delivery-tracking`](?demo=artifact-chat-container/delivery-tracking).

{% demo src="artifact-chat-container/delivery-tracking" %}

## FloatingSheet

The map chat and delivery tracker float on `FloatingSheet`: glass or opaque, peeking or docked, with a drag that snaps open and folds into a FAB. The floating chat here shares the same velocity-aware gesture (`useSpringSheetDrag`) through the Composer's top bump. Its appearances, drag behavior, slots, and full props are documented on the [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) page.

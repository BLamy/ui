# Composer

A prompt box for an agent or a chat, as parts in the spirit of shadcn's `InputGroup`: the root owns the draft (Markdown and attachments), the card holds the editor and its addons, option pills sit in the footer, and **bumps** attach above or below the card. Compose exactly the box you need, from a bare editor with a send button to the full T3 Code layout. The editor is `@brett_lamy/docstream-editor`, so drafts use the same GitBook-flavored Markdown as rendered replies. Its menus, buttons and lightbox are the kit's own (DropdownMenu, Button, ImageAnnotator), so they look and behave like them in every theme scope.

Use something else when: a plain multi-line field is enough ([Textarea](https://blamy.github.io/ui/#/textarea)); you want the whole thread around the box, with its empty state and dock ([Conversation](https://blamy.github.io/ui/#/conversation)); the chat sits beside or over other content ([ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/composer.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Composer, ComposerCard, ComposerInput, ComposerFooter,
  ComposerSend,
} from '@/components/ui/composer/composer'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Composer, ComposerCard, ComposerInput, ComposerFooter,
  ComposerSend,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
import {
  Composer, ComposerCard, ComposerAttachments, ComposerInput, ComposerExpand,
  ComposerFooter, ComposerOptions, ComposerSelect, ComposerSeparator, ComposerSpacer,
  ComposerAdd, ComposerSend,
} from '@/components/ui/composer/composer'

<Composer onSubmit={(markdown, attachments) => send(markdown, attachments)} streaming={busy} onStop={stop}>
  <ComposerCard>
    <ComposerExpand />
    <ComposerAttachments />
    <ComposerInput placeholder="Ask anything" />
    <ComposerFooter>
      <ComposerOptions>
        <ComposerSelect aria-label="Effort" items={[{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }]} />
        <ComposerSeparator />
        <ComposerSelect aria-label="Access" icon="lock-rounded" items={access} />
      </ComposerOptions>
      <ComposerSpacer />
      <ComposerAdd icon="paperclip-diagonal" label="Attach files" />
      <ComposerSend />
    </ComposerFooter>
  </ComposerCard>
</Composer>
```

The smallest composition is a card, the editor and send. Press Enter and watch send turn into stop and back:

{% demo src="composer/minimal" %}

## Anatomy

```
Composer                    root: the draft, attachments, streaming, disabled
├─ ComposerBump side="top"  a strip tucked behind the card (draggable: a sheet)
│  ├─ ComposerBumpContent   what a draggable bump reveals
│  └─ ComposerBumpHandle    its row (and grip)
├─ ComposerCard             the bordered surface; a drop zone for files
│  ├─ ComposerExpand        tall drafting mode (top-right corner)
│  ├─ ComposerAttachments   the tile strip (block-start)
│  ├─ ComposerInput         the Docstream editor
│  ├─ ComposerAddon         any row or column beside the input
│  └─ ComposerFooter        the block-end row
│     ├─ ComposerOptions    option pills (ComposerSelect, ComposerPill, ComposerSeparator)
│     ├─ ComposerSpacer
│     └─ ComposerAdd · ComposerStop · ComposerSend
├─ ComposerBump side="bottom"
│  └─ ComposerBumpHandle    ComposerText, ComposerOptionsOutlet…
├─ ComposerCards            morphing cards above or below
└─ ComposerQueue            drafts sent while a reply streams
```

Addons and bumps order themselves (block-start → input → block-end, top bumps above, bottom below), so they can be written in any order.

## Props

### Composer

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange(markdown, details)` | `''` | The draft as Markdown (image chips are `![name](attachment:id)`). Reason `input-change`, `send` or `imperative`. |
| `attachments` / `defaultAttachments` / `onAttachmentsChange(attachments, details)` | `[]` | The files in the draft. Reason `picker`, `drop`, `paste`, `remove`, `annotate`, `send` or `imperative`. |
| `expanded` / `defaultExpanded` / `onExpandedChange(expanded, details)` | `false` | Tall drafting mode (`press` or `imperative`). |
| `collapsed` / `defaultCollapsed` / `onCollapsedChange(collapsed, details)` | `'none'` | `'none' \| 'compact' \| 'fab'` (`scroll`, `press` or `imperative`). See *Collapse*. |
| `streaming` | `false` | A reply is arriving: send holds (or queues) and `ComposerSend` becomes the stop control. |
| `onStop()` | — | Stop pressed. |
| `onSubmit(markdown, attachments)` | — | The trimmed draft and its attachments, after the draft has emptied. |
| `disabled` | `false` | Nothing can be typed, attached, chosen or sent; sets `data-disabled`. |
| `annotator` | provider's, else `PencilKitAnnotator` | The [ImageAnnotator](https://blamy.github.io/ui/#/pencilkit) engine an image attachment opens; `null` opens a plain preview. |
| `acceptedFileTypes` | any | MIME types, wildcards and extensions (`['image/*', '.md']`). |
| `maxFileSize` / `maxFiles` | — | Larger files and files past the count are turned away. |
| `onDropFiles(files, source)` | — | Sees each batch that passed: return `false` to take them yourself, or an array to attach those instead. |
| `onFilesRejected(rejections)` | warning toast | Replaces the toast for files turned away (`reason`: `type`, `size`, `count`). |
| `collapseOnScroll` | — | A scroller ref (the transcript): scrolling away from its anchor collapses the composer. |
| `collapseTo` | `'compact'` | How far scrolling collapses it: `'compact'` or `'fab'`. |
| `collapseAnchor` | `'bottom'` | Which end of the scroller is home (`'top'` for documents). |
| `fabAlign` | `'end'` | Where the FAB sits along the inline axis: `'start' \| 'center' \| 'end'`. |
| `fabIcon` | compose glyph | The FAB's icon. |

Every callback runs before the state moves, and `details.cancel()` keeps an uncontrolled value as it was. A send empties the draft first (reason `send` on both, with the click or key behind it): canceling either refuses the send, so nothing reaches `onSubmit` or the queue and the editor keeps the draft. The root takes `className`, `style` and `ref`. Parts read the state with [`useComposer()`](https://blamy.github.io/ui/#/hooks-composer).

### ComposerCard

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `'default'` | `default`: card corners; `lg`: sheet corners (T3 Code). |
| `dropZone` | `true` | The card is UI SDK's `FileInputDropzone`: files dropped on it, or pasted while focus is inside it, attach. |
| `dropLabel` | "Drop to attach" | The overlay's title while files hover. |

`ComposerAddon` takes `align="block-start" | "block-end" | "inline-start" | "inline-end"`; `ComposerFooter` is the block-end row. Both, like every part below, take `className`, `style`, `ref` and the element's props.

### ComposerInput

| Prop | Default | Effect |
| --- | --- | --- |
| `placeholder` | "Ask anything — @ files, / commands, paste images" | |
| `aria-label` | "Message" | The editor's name (a contenteditable has none of its own). |
| `autoFocus` | `false` | Focus the editor when it mounts. |
| `imagePaste` | `'chip'` | Pasted images become attachment chips, or inline image blocks (`'inline'`). |
| `slashMenu` | `true` | The "/" command menu. |
| `references` | — | What "@" and "#" offer (the Docstream editor's reference sources). |

Enter sends from a plain paragraph (lists, quotes, tables and code keep their own Enter), ⌘/Ctrl+Enter always sends, Shift+Enter breaks the line. Pasted Markdown becomes structure.

### ComposerSend, ComposerStop, ComposerAdd, ComposerExpand

| Part | Props | Notes |
| --- | --- | --- |
| `ComposerSend` | `morph` (default `true`), `stopVariant` (`'ring' \| 'solid'`), Button props | The kit's `default` Button as a 30px circle. Disabled while there is nothing to send. While streaming it becomes the stop control (`morph={false}` keeps the arrow: pair it with `ComposerStop`). `data-state` is `send`, `queue` or `stop`. |
| `ComposerStop` | `variant` (`'ring'` spinning ring, `'solid'` red circle), `forceMount`, Button props | Renders only while streaming, and pops in beside its neighbours. |
| `ComposerAdd` | `icon` (default `plus`), `label` (default "Add files"), `acceptedFileTypes`, `multiple` (default `true`), `directory`, `capture` | UI SDK's `FileInputTrigger` in the kit's `quiet` `icon-sm` Button look. The paperclip is `<ComposerAdd icon="paperclip-diagonal" label="Attach files" />`. |
| `ComposerExpand` | Toggle props | UI SDK's `Toggle` (`aria-pressed`) in the card's top-right corner. |

Any other button in a composer is the kit's [Button](https://blamy.github.io/ui/#/button): `<Button variant="quiet" size="icon-sm">` for a tool, the same metrics as `ComposerAdd`. On a touch screen every composer control answers presses 44px wide without changing its drawn size.

### Option pills: ComposerSelect and ComposerPill

`ComposerSelect` is a pill that opens a small menu of choices. It is a preset of the kit's parts, so its menu is the kit's `DropdownMenuContent size="sm"` with `DropdownMenuRadioItem` rows, worn in the palette of the surface it opened from (`palette="trigger"`).

| Prop | Default | Effect |
| --- | --- | --- |
| `aria-label` | required | Names the choice; the pill is named "Effort: Medium · 1M" (its label, then what it shows). |
| `items` | required | `{ value, label, short?, description?, disabled? }[]`; `short` is what the pill shows while chosen, `description` a second line in the menu. |
| `value` / `defaultValue` / `onValueChange(value, details)` | first item | `details.cancel()` keeps an uncontrolled pill's value. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | | The menu's open state (DropdownMenu's). |
| `side` / `align` | `top` / `start` | Where the menu opens against the pill. |
| `icon` | — | A leading glyph (`Icon` name or node). |
| `disabled` | Composer's | |

For anything more (groups, a search field, a popover), compose the parts yourself with `ComposerPill` as the trigger. `ComposerPill` is the quiet Button at the footer's density with `icon`, the label (a changed label morphs by its shared letters) and a chevron:

```tsx
import { ComposerPill } from '@/components/ui/composer/composer'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuGroupLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'

<DropdownMenu>
  <DropdownMenuTrigger render={<ComposerPill icon="asterisk" aria-label={`Model: ${model}`} />}>{model}</DropdownMenuTrigger>
  <DropdownMenuContent size="sm" side="top" align="start" palette="trigger">
    <DropdownMenuGroup>
      <DropdownMenuGroupLabel>Anthropic</DropdownMenuGroupLabel>
      <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
        <DropdownMenuRadioItem value="opus" description="Most capable">Claude Opus 5.5</DropdownMenuRadioItem>
        …
```

Color a pill with `className` (`className="text-primary"` for the accent). The t3-clone block's `ModelPicker` is a pill on a [Popover](https://blamy.github.io/ui/#/popover) (`<PopoverContent variant="surface" palette="trigger">`) holding a searchable command list.

Wrap the pills in `ComposerOptions`: they stay on one line and scroll sideways when the footer is too narrow (no orphaned separator on a wrapped row), and while the composer is `compact` they move, as the same elements with their menus' state, into the `ComposerOptionsOutlet`, usually in the bottom bump.

### ComposerBump

| Prop | Default | Effect |
| --- | --- | --- |
| `side` | `'bottom'` | Which edge of the card it hangs off. |
| `variant` | `'attached'` | `attached`: tucked behind the card, same border; `detached`: a separate strip; `flush`: no chrome. |
| `gutter` | `12` | How far an attached bump stands in from the card's edges (px); a draggable one widens to them as it opens. |
| `draggable` | `false` | A top bump whose handle drags its `ComposerBumpContent` open, like a sheet. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | `false` | A draggable bump's state (`press`, `drag`, `escape-key`, `imperative`). |
| `peek` | `0` | Body height kept visible while closed. |
| `maxReveal` / `bounds` / `boundsInset` | `320` | The open height, or grow to an element's top edge. |
| `closeOnEscape` | `true` | Escape closes an open draggable bump (it is a layer, so a menu opened from it closes first). |
| `minimizable`, `minimized`, `onMinimizedChange`, `onProgressChange` | | For a host that drives a floating surface from the bump (ArtifactChatContainer's floating layout). |

`ComposerBumpHandle` is the bump's row (`grip`, default `true`, and `label` for the grip's name); in a draggable bump the whole row is the drag handle and a tap on it toggles. `ComposerBumpContent` (`label`, default "Details") is the revealed region. `ComposerText` (`icon`) is muted inline text for a bump or a footer hint; `ComposerSpacer` pushes what follows to the end; `ComposerSeparator` is a short vertical [Separator](https://blamy.github.io/ui/#/separator).

{% demo src="composer/compositional-parts" %}

## Collapse: compact and FAB

`collapsed` folds the same composition: the card is one element that springs between shapes, never a second copy. **Compact** is a single-row pill: the editor on the left, attach / stop / send on the right, and the `ComposerOptions` pills moved into the bottom bump. **FAB** folds everything into a round button: the card shrinks into the circle and grows back out of it; pressing it restores the composer and focuses the editor.

```tsx
<Composer collapseOnScroll={transcriptRef} collapseTo="fab" fabAlign="end">
  <ComposerCard>…</ComposerCard>
  <ComposerBump side="bottom">
    <ComposerBumpHandle>
      <ComposerText icon="folder-closed">Local checkout</ComposerText>
      <ComposerOptionsOutlet />
    </ComposerBumpHandle>
  </ComposerBump>
</Composer>
```

`collapseOnScroll` ties it to the transcript. Chats rest at their newest message, so scrolling up collapses to `compact`; with `collapseTo="fab"` a flick or a long read back folds it into the FAB; scrolling back down, or pressing the FAB, restores it. `collapseAnchor="top"` flips this for documents. It never collapses while it has focus, an attachment or the annotator open, and a draft or a streaming reply never folds into the FAB.

## Files and images

Files come in three ways, all through one door (`attachFiles`): `ComposerAdd`, a **drop** on the card, or a **paste** anywhere in the card. Images chip into the draft where they land (at the drop point over the text, else at the caret) and appear in the strip; every other file becomes a tile: a video's first frame, code's first lines, or a glyph in the kind's color with its name, extension and size. Sizes read like the editor's chips ("84 KB", "1.3 MB").

```tsx
<Composer
  acceptedFileTypes={['image/*', 'video/*', 'application/pdf', '.md', '.ts', '.tsx']}
  maxFileSize={10 * 1024 * 1024}
  maxFiles={8}
  onSubmit={(markdown, attachments) => upload(attachments.map((a) => a.file))}
>
  <ComposerCard>
    <ComposerAttachments />
    <ComposerInput />
    <ComposerFooter>
      <ComposerAdd />
      <ComposerSpacer />
      <ComposerSend />
    </ComposerFooter>
  </ComposerCard>
</Composer>
```

- Files outside `acceptedFileTypes`, over `maxFileSize` or past `maxFiles` are turned away with one grouped warning toast (mount a `ToastRegion`), or through `onFilesRejected`.
- Each attachment is `{ id, name, size, type, kind, file, src, preview?, excerpt? }`; `kind` is `image | video | audio | pdf | text | archive | other` and `file` is the original `File`. Images keep a data URL; other files an object URL, revoked when the attachment leaves (files handed to `onSubmit` stay valid until the Composer unmounts).
- ✕, or Backspace / Delete on a focused tile, removes one; focus moves to the next tile, else the editor. What was attached is announced.

{% demo src="composer/files-and-drop" %}

Pressing an image (its thumbnail or its chip in the text) opens the [ImageAnnotator](https://blamy.github.io/ui/#/pencilkit): the image flies out of what you pressed, a PencilKit surface lies over it, and Save flattens the strokes into it and replaces the attachment (reason `annotate`). `annotator` swaps the engine for one composer; an `ImageAnnotatorProvider` swaps it for a subtree; `null` makes it a plain preview.

```tsx
import { ImageAnnotatorProvider } from '@/components/ui/pencilkit/image-annotator'

<ImageAnnotatorProvider engine={StampEngine}>
  <App />
</ImageAnnotatorProvider>
<Composer annotator={null}>…</Composer>   // plain preview
```

{% demo src="composer/image-chips" %}

## Disabled

`disabled` stops everything a person could do to the draft: the editor is read-only, `ComposerAdd`, the pills and send are disabled, drops and pastes are ignored, and the root has `data-disabled`. Controls of your own in a bump stay live, so a "raise the limit" button keeps working:

{% demo src="composer/credit-limit" %}

## Morphing cards

`ComposerCards` is a tray of cards on one side of the composer (`side="top"` or `"bottom"`), for things that belong to the next message but are not part of the draft: a connector to set up, the context that will go with it, a step an agent just finished. Its `ComposerMorphCard`s come out of the composer like a drop of liquid: a new card starts inside the surface next to it and slides out, the two outlines necking in and pinching off; removing one plays that backwards. Cards are keyed children, so adding and removing them is just rendering.

{% demo src="composer/morph-cards" %}

```tsx
import { ComposerCards, ComposerMorphCard } from '@/components/ui/composer/composer-cards'

<Composer>
  <ComposerCards side="top">
    {suggest ? <ComposerMorphCard key="notion">…</ComposerMorphCard> : null}
  </ComposerCards>
  <ComposerCard>…</ComposerCard>
</Composer>
```

A card grows out of the surface on its inner side: the composer's card, or the outermost attached or detached bump on that side. While surfaces are joined, the outline is one SVG path drawn in the source's own computed background, border, radius and shadow, so joined and separate look identical in light and dark. Under reduced motion cards appear and disappear without the morph.

{% demo src="composer/morph-from-bump" %}

| Prop | Default | Effect |
| --- | --- | --- |
| `side` | `top` | Above or below the composer. |
| `gap` | `8` | Space between a card and the surface it came out of, at rest (px, at least 6). |
| `animateOnMount` | `false` | Morph in the cards that are there when the tray mounts. |
| `ComposerMorphCard` `onExited` | — | Called once a removed card has sunk back into its source. |

## Queued messages

`ComposerQueue` puts the cards to work. While a reply streams, sending no longer waits: the draft becomes a card that morphs out of the top of the composer and the draft clears for the next message. When the reply ends, the oldest card merges back in and goes to `onSubmit`. Each card can be edited (its text and attachments return to the draft), sent now (stops the reply, then sends), or removed.

{% demo src="composer/queue" %}

```tsx
import { ComposerQueue } from '@/components/ui/composer/composer-cards'

<Composer streaming={busy} onSubmit={send} onStop={stop}>
  <ComposerQueue />
  <ComposerCard>…</ComposerCard>
</Composer>
```

With a queue mounted, `ComposerSend` stays a send arrow ("Queue message") while there is a draft during a reply. `items` / `defaultItems` / `onItemsChange(items, details)` make the queue controlled (`{ id, markdown, attachments }[]`; reason `queue`, `send`, `edit`, `remove` or `imperative`; `details.cancel()` keeps a card). `autoSend={false}` leaves sending to each card's **Send now**, and `renderItem(item, { edit, sendNow, remove })` draws your own card. When a card leaves while it holds focus, focus moves to the same button on the next card, else the editor.

## Custom compositions

An `inline-start` addon before the editor and an `inline-end` one after it, in one row:

{% demo src="composer/inline-start-addon" %}

## Accessibility

- The editor is named by `ComposerInput`'s `aria-label` ("Message"). Every button is named: "Send", "Stop", "Queue message", "Add files", "Expand composer" (pressed while expanded), "Annotate header.png", "Remove header.png", "Open composer" (the FAB).
- A select pill's name starts with its label and contains what it shows ("Effort: Medium · 1M"), so a voice user can say what they see. Its menu is the kit's DropdownMenu: arrow keys, typeahead, Escape.
- A draggable bump's grip is a button with `aria-expanded` and `aria-controls` pointing at its `ComposerBumpContent` region; an open bump is a layer, so Escape closes the innermost thing first.
- On a touch screen (`pointer: coarse`) every control answers presses 44px wide.
- Reduced motion turns every spring and morph into an instant change.

## Motion

Every state change moves rather than swaps, on the kit's springs: send ↔ stop is one button; expand springs the card; attachments pop in and out while neighbours slide; the drop overlay springs in; the annotated image flies out of what you pressed and back; pill labels morph; cards neck out of the composer; draggable bumps follow the finger and settle on the `tray` spring. Parts that come and go stay mounted through their exit (the kit's presence hooks on UI SDK's `animateIn` / `animateOut`).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `composerFabVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
[ pressable, pressableFocusRing, 'z-3 grid size-[52px] cursor-pointer place-items-center rounded-full border border-border bg-card p-0 text-foreground shadow-hud', ]
```

No variants.

### `composerCardVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
[ 'group/composer-card relative z-1 box-border flex min-w-0 flex-wrap items-center border border-border bg-card shadow-raised', // Folded into the FAB, the card sits where the Composer's `fabAlign` says. 'group-data-[fab-align=start]/composer:data-folded:self-start group-data-[fab-align=center]/composer:data-folded:self-center group-data-[fab-align=end]/composer:data-folded:self-end', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-card` |
| `lg` | `rounded-sheet` |

### `composerAddonVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
box-border flex min-w-0 items-center gap-[5px]
```

**`align`** — default `block-end`

| Value | Adds |
| --- | --- |
| `block-start` | `order-[-2] w-full px-3 pt-2.5` |
| `inline-start` | `order-[-1] shrink-0 self-start pt-2 pl-2` |
| `inline-end` | `order-1 shrink-0 self-start pt-2 pr-2` |
| `block-end` (default) | `order-2 w-full px-2 pt-1 pb-2` |

### `composerBumpVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
relative box-border flex min-w-0 flex-col text-caption text-muted-foreground
```

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `top` | `order-[-1]` |
| `bottom` (default) | `order-1` |

**`variant`** — default `attached`

| Value | Adds |
| --- | --- |
| `attached` (default) | `border border-border bg-popover` |
| `detached` | `rounded-lg bg-secondary` |
| `flush` | — |

6 compound variants — see the source.

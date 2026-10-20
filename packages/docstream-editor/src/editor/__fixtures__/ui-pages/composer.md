# Composer

The Workbench prompt box is a set of parts, in the spirit of shadcn's `InputGroup`: the root owns the draft, the card holds the editor and its addons, and **bumps** attach above or below the card. Compose exactly the box you need — a bare editor with a send button, the Workbench default, or the full T3 Code layout below. The editor is `@brett_lamy/docstream-editor`, so drafts use the same GitBook-flavored Markdown model as rendered replies.

{% tabs title="Installation" sync="install" %}
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
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/composer.json{% endcommand %}

Adds `@/components/ui/composer.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  Composer, ComposerCard, ComposerInput, ComposerFooter,
  ComposerSend,
} from '@/components/ui/composer'
```
{% endtab %}
{% endtabs %}

```tsx
import {
  Composer, ComposerBump, ComposerBumpHandle, ComposerBumpContent, ComposerCard, ComposerButton,
  ComposerAttachments, ComposerInput, ComposerExpand, ComposerFooter, ComposerSelect,
  ComposerSeparator, ComposerSpacer, ComposerAttach, ComposerStop, ComposerSend,
  ComposerText, ModelPicker,
} from '@brett_lamy/ui'

<Composer onSubmit={(markdown, attachments) => send(markdown, attachments)} streaming={busy} onStop={stop}>
  <ComposerBump side="top" draggable>              {/* drag the handle up to reveal the log */}
    <ComposerBumpContent><DevServerLog /></ComposerBumpContent>
    <ComposerBumpHandle>
      <ComposerText className="flex-1">● Monitoring</ComposerText>
      <ComposerButton variant="pill" onPress={stopServer}>Stop</ComposerButton>
    </ComposerBumpHandle>
  </ComposerBump>
  <ComposerCard size="lg">
    <ComposerAttachments />                         {/* block-start: thumbnails */}
    <ComposerInput placeholder="Ask anything" />
    <ComposerExpand />
    <ComposerFooter>                                {/* block-end */}
      <ModelPicker models={models} providers={providers} />
      <ComposerSeparator />
      <ComposerSelect aria-label="Effort" options={efforts} />
      <ComposerSeparator />
      <ComposerSelect aria-label="Access" icon="lock" options={access} />
      <ComposerSpacer />
      <ComposerAttach />
      <ComposerStop variant="solid" />
      <ComposerSend morph={false} />
    </ComposerFooter>
  </ComposerCard>
  <ComposerBump side="bottom">
    <ComposerBumpHandle>
      <ComposerText icon="folder" className="flex-1">Local checkout</ComposerText>
      <ComposerText icon="branch">main</ComposerText>
    </ComposerBumpHandle>
  </ComposerBump>
</Composer>
```

`WorkbenchComposer` is the Workbench's default composition (card, attachments, expand, model / effort / access pills, send, and the detached checkout strip) — put it in a `ConversationComposer` (see [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell)), or compose your own from these parts.

## Parts

| Part | Role |
| --- | --- |
| `Composer` | Root and state. `value` / `defaultValue` / `onValueChange` (Markdown), `attachments` / `defaultAttachments` / `onAttachmentsChange`, `expanded` / `defaultExpanded` / `onExpandedChange`, `streaming`, `onStop`, `onSubmit(markdown, attachments)`, `annotator` (see *Image annotation* below). Parts read it with `useComposer()` (`send`, `stop`, `canSend`, `attachFiles`, `removeAttachment`, `annotate`, …). |
| `ComposerCard` | The bordered surface (`size="default"` 15px corners, `size="lg"` 22px). Its addons order themselves, so they can be written in any order. |
| `ComposerAddon` | `align="block-start" \| "block-end" \| "inline-start" \| "inline-end"` — a row above/below the input or a column beside it. `ComposerFooter` is the block-end row. |
| `ComposerInput` | The Docstream WYSIWYG editor (slash menu, Markdown paste, image chips). |
| `ComposerAttachments` | Thumbnail strip (block-start): click to annotate (or preview, with `annotator={null}`), ✕ to remove. |
| `ComposerButton` | `variant="ghost" \| "pill" \| "primary" \| "destructive"`, plus `tint`. `ComposerPillLabel` draws icon + label + chevron. |
| `ComposerSelect` | An option pill that opens a react-aria `Menu`; ticks on selection. `options: { id, label, short?, description? }[]`. |
| `ComposerSend` / `ComposerStop` | Send circle, disabled while empty. It morphs into the stop control while `streaming` (`morph={false}` keeps it; pair it with `<ComposerStop variant="solid" />`). |
| `ComposerAttach` | Paperclip → file picker → attachments, inserted as chips at the caret. |
| `ComposerExpand` | Toggles the tall drafting mode; sits in the card's top-right corner. |
| `ComposerSeparator`, `ComposerSpacer`, `ComposerText` | Footer rule, flex spacer, muted text with an icon. |
| `ComposerBump` | A strip attached above (`side="top"`, tucked behind the card) or below the card. `variant="attached" \| "detached" \| "flush"`. Bumps lay out by `side` wherever they are placed. |
| `ComposerBumpHandle` / `ComposerBumpContent` | With `draggable`, the handle pulls the content open one-to-one with the pointer; release snaps open or closed with a tick; a tap toggles, Escape closes. `open` / `onOpenChange`, `peek`, `maxReveal` or `bounds`, `minimizable`, and `onProgressChange({ progress, reveal, minimize, dragging })` let a host drive a sheet from it. |
| `ComposerOutlet` | Lets an ancestor add parts to the Composer inside it, or wrap its card. `ArtifactChatContainer` uses it to hang its transcript off a draggable top bump. |
| `ComposerOptions` / `ComposerOptionsOutlet` | Wrap the option pills in `ComposerOptions`; while the composer is `compact` they move (same elements, menus keep their state) into the `ComposerOptionsOutlet`, usually in the bottom bump. |
| `ComposerFab` | The round button a composer folds into (`collapsed="fab"`); `FloatingChat` reuses it for its minimized chat. |

## Compact, FAB, and scroll-linked collapse

`collapsed` (`'none' | 'compact' | 'fab'`, with `defaultCollapsed` / `onCollapsedChange`) folds the same composition — and it is the *same* composition throughout: the card is one element that springs between shapes, never a second copy cross-fading in. **Compact** is a single-row pill in the style of T3 Code: the editor on the left, the footer's attach / stop / send inline on the right, and the `ComposerOptions` pills moved into the bottom bump — `📁 Local checkout | Claude Opus 5.5 | Medium · 1M | Full access … main`. **FAB** folds everything into a round button: the card itself shrinks into the circle (its content fading, the bumps folding away) and grows back out of it; tapping it restores the composer and focuses the editor, with a tick. Going compact, the option pills fly from the footer into the bottom bump as the same elements.

```tsx
<Composer collapseOnScroll={scrollerRef} collapseTo="fab">
  <ComposerCard>
    <ComposerInput />
    <ComposerFooter>
      <ComposerOptions><ModelPicker … /><ComposerSelect … /></ComposerOptions>
      <ComposerSpacer /><ComposerAttach /><ComposerSend />
    </ComposerFooter>
  </ComposerCard>
  <ComposerBump side="bottom">
    <ComposerBumpHandle>
      <ComposerText icon="folder">Local checkout</ComposerText>
      <ComposerOptionsOutlet />
      <ComposerSpacer />
      <ComposerText icon="branch">main</ComposerText>
    </ComposerBumpHandle>
  </ComposerBump>
</Composer>
```

`collapseOnScroll` ties it to a scroller beside it — for a chat, the transcript. Chats rest at their newest message, so the anchor is the **bottom** by default: scrolling **up** (away from the latest) collapses the composer to `compact`, and with `collapseTo="fab"` a **flick** (a fast scroll, measured over the last ~100ms) or a long read back folds it all the way into the FAB. Scrolling back **down** near the newest message — or tapping the FAB — restores it (a FAB heading back opens to the one-row composer on the way). `collapseAnchor="top"` flips this for documents that start at the top. The card springs between shapes; reduced motion switches instantly. The composer never collapses while it has focus, an attachment, or the annotator open, and a draft or a streaming reply never folds into the FAB.

## Rich editing

- Type `/` to insert headings, code blocks, hints, tables, lists, and other Docstream blocks.
- Pasted Markdown is parsed into structured editor nodes.
- Enter sends from a plain top-level paragraph. Inside lists, quotes, tables, hints, or code blocks it keeps the editor's native behavior. ⌘/Ctrl+Enter always sends and Shift+Enter inserts a hard break.

## Pasted images become chips

`ComposerInput` uses the editor's `imagePaste="chip"` mode. A pasted or dropped image lands as a compact chip exactly where it was pasted — thumbnail, name and size — and its file joins the Composer's `attachments`, so it also appears in `ComposerAttachments`. Hovering a chip shows the full image; clicking the chip or its thumbnail opens `AnnotateLightbox` — a PencilKit drawing surface over the image. Saving flattens the strokes into the image and replaces the attachment's `src`, so the chip and the thumbnail update together. Removing a thumbnail removes its chip; deleting the chip removes the attachment. The sent Markdown refers to each image as `![image.png](attachment:att-…)`, and `onSubmit` receives the attachments alongside it.

## Image annotation

Pressing an attachment annotates it with [PencilKit](https://blamy.github.io/ui/#/pencilkit) out of the box: `PencilKitAnnotator` lays a canvas over the image with its tool, ink and undo bar underneath, and Save flattens the strokes into it. No setup is needed. The annotator is pluggable — swap it for every Composer below a provider, or for one Composer; `null` opts out, and pressing an attachment then opens a plain preview of the image:

```tsx
import { ComposerAnnotatorProvider, Composer } from '@brett_lamy/ui'

<ComposerAnnotatorProvider annotator={StampAnnotator}>
  <App />
</ComposerAnnotatorProvider>

// or per composer
<Composer annotator={StampAnnotator}>…</Composer>
<Composer annotator={null}>…</Composer> // plain preview
```

An annotator is any component that calls its `children` with the surface — `{ canvas, toolbar?, title? }` — and returns the result; the canvas is stretched over the image and its first `<svg>` is flattened into the image on save:

```tsx
function StampAnnotator({ children }: ComposerAnnotatorProps) {
  const [dots, setDots] = useState<[number, number][]>([])
  const stamp = (e: React.MouseEvent) =>
    setDots([...dots, [e.nativeEvent.offsetX, e.nativeEvent.offsetY]])
  return children({
    title: 'Stamp — click to mark',
    canvas: (
      <svg className="absolute inset-0 size-full" onClick={stamp}>
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={10} fill="none" stroke="#FF375F" />
        ))}
      </svg>
    ),
  })
}
```

`AnnotateLightbox` takes the same `annotator` prop when you open it yourself.

## ModelPicker

A searchable model menu in the style of T3 Code, and the footer's model pill. Search across every model; a vertical provider rail (favorites first) switches the list; rows show the name, a `NEW` badge, the provider, a `⌘N` shortcut and a favorite star; **Legacy models** opens a submenu. Arrow keys, typeahead, and ⌘1…⌘9 work while it is open, and every pick ticks. It is built on react-aria `DialogTrigger`, `SearchField`, vertical `Tabs`, `GridList`, and `SubmenuTrigger`, and it reads the Workbench palette off its trigger, so it matches light and dark surfaces.

```tsx
<ModelPicker
  models={[{ id: 'opus', name: 'Claude Opus 5.5', provider: 'anthropic', badge: 'NEW', shortcut: 1 }, …]}
  providers={[{ id: 'anthropic', name: 'Anthropic', icon: <AnthropicGlyph /> }, …]}
  value={model} onChange={setModel}
  favorites={favorites} onFavoritesChange={setFavorites}
/>
```

## Empty state

A thread with no messages renders the **centered composer**: glyph, "What are we building?", the composer, and three suggestion chips that send on tap. Press the `+` in any header to get there. Sending the first message keeps the composer: the greeting leaves, and the same composer travels down to its dock as the thread's first turn rises in (see [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell)).

## Motion

Every state change moves rather than swaps, after Benji Taylor's [Family Values](https://benji.org/family-values), on the kit's spring vocabulary (`springs`, `--ease-spring-*`):

- **Send ↔ stop** is one button: the fill drains (or turns red with `stopVariant="solid"`) and the arrow turns into the stop glyph. A standalone `ComposerStop` pops in beside its neighbours.
- **Expand** springs the card to its tall drafting height; the icon morphs.
- **Attachments** pop into the strip (it opens as a height morph) and out of it, neighbours sliding over.
- **Annotate** zooms the image out of the thumbnail or chip you pressed and, on Cancel or Save, back into it.
- **Option pills** morph their label by the letters old and new share; menu ticks pop in.
- **Draggable bumps** follow the finger, then settle on a spring that keeps the release velocity — a flick opens or closes them.

`prefers-reduced-motion` turns movement into instant changes.

## Live examples

The T3 Code layout in three modes (switch in the card header). **Full**: flick the top bump's handle up to reveal the log, open the model pill, paste an image, or type `/`. **Compact**: the single-row composer with its options in the bottom bump. **Scroll → FAB**: a chat transcript that opens at its newest message — scroll up to read back and the composer folds to one row; flick up and it folds into a button; scroll back down (or tap the button) and it returns.

{% demo src="composer/compositional-parts" %}

The smallest composition — a card, the editor and send. Press Enter and watch send turn into stop and back:

{% demo src="composer/minimal" %}

Image chips and the annotator. Press the thumbnail or the chip; remove the thumbnail to see the strip fold away:

{% demo src="composer/image-chips" %}

A custom composition: an `inline-start` addon before the editor and an `inline-end` addon after it, in one row:

{% demo src="composer/inline-start-addon" %}

# DiagramFrame

A board with a panel beside it: a [Diagram](#/diagram) (or anything else on a board) and what's about it, like a machine and its simulation, or services and the one selected. The panel is an [AdaptivePane](#/adaptive-pane), so it's the kit's responsive pattern rather than a layout of its own: a **column** beside the board when there's the room, a **drawer** over the board at medium sizes that doesn't dim it, so the board stays in sight and in reach while you use the panel, and on a phone a **page pushed over the board**, with a back button to it. While the panel's closed, a bar floats on the board with a status and the button that opens it.

Use [AdaptivePane](#/adaptive-pane) directly for a pane beside a page that isn't a board, [SplitView](#/split-view) for list and detail columns that become a stack, and [Sheet](#/sheet) for a modal panel that isn't part of the layout. [StateDiagram](#/state-diagram) and [CloudflareDiagram](#/cloudflare-diagram) are made of this.

{% hint style="info" %}
**Why it's its own component, not an AdaptivePane variant.** It *is* AdaptivePane for the panel. What it adds is what a board needs around it: its own size class (a board is usable narrower than a page), a status bar on the board while the panel's closed, a drawer that leaves the board live, a cover for what's inside a node, and the panel's sections and commit-on-Enter fields. Those are a composition of AdaptivePane, Field and Input, written once.
{% endhint %}

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/diagram-frame.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  DiagramFrame, DiagramFrameBoard, DiagramFrameBar,
  DiagramFramePanel,
} from '@/components/ui/diagram-frame'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  DiagramFrame, DiagramFrameBoard, DiagramFrameBar,
  DiagramFramePanel,
} from '@brett_lamy/ui/diagram-frame'
```
{% endtab %}
{% endtabs %}

## Usage

Like the library's other containers, the frame fills the nearest positioned box. Put the board and its bar in `DiagramFrameBoard`, and what's about it in `DiagramFramePanel`:

```tsx
<div className="relative h-[480px]">
  <DiagramFrame>
    <DiagramFrameBoard>
      <Diagram nodes={nodes} edges={edges} selection={selection} onSelectionChange={setSelection} />
      <DiagramFrameBar>{selected ? selected.label : `${nodes.length} steps`}</DiagramFrameBar>
    </DiagramFrameBoard>
    <DiagramFramePanel title="Inspector" backLabel="Rules">
      <DiagramFrameSection title="This step">
        <DiagramFrameInput label="Name" value={selected.label} onValueCommit={rename} />
      </DiagramFrameSection>
    </DiagramFramePanel>
  </DiagramFrame>
</div>
```

{% demo src="diagram-frame/inspector" %}

## Presentations

The frame measures its own width (`breakpoints`, default 440 and 720 px) and is a size-class scope, so popups inside follow it too. `presentation="auto"` (the default) resolves from that, the same rule as AdaptivePane's:

| The frame is | The panel is | Open at first |
| --- | --- | --- |
| regular (720 px and up) | a column beside the board | yes |
| medium (440 to 720) | a drawer over the board, from its side, non-modal: the board isn't dimmed and still takes presses | no |
| compact (under 440) | a page pushed over the board, with a back button that names it (`backLabel`) | no |

`presentation` forces one (`column`, `drawer`, `push`, `cover`); `side="start"` puts it on the leading edge. `open` / `defaultOpen` / `onOpenChange(open, details)` control it: `details.reason` is AdaptivePane's (`trigger-press`, `close-press`, `escape-key`, `swipe`, `back`…), and `details.cancel()` keeps it as it is. `modal` on the panel makes a drawer dim and block the board.

## The bar, the trigger and the cover

`DiagramFrameBar` floats at the foot of the board while the panel's closed: its children are a status, read politely as it changes, and its trigger opens the panel. `DiagramFrameTrigger` is that button on its own (its text is the panel's title), for a toolbar of your own (`render`). Opened by its trigger as a column, focus goes into the panel; closed from inside, it comes back to the trigger. A drawer and a pushed page move focus themselves.

`DiagramFrameCover` goes over all of it: something to see in place of the board, like what's inside a node. The board and the panel stay as they are underneath, inert. Render it while it shows, and give it a way back.

## Panel parts

`DiagramFrameSection` is a titled region of the panel (its title is a grouped section label). `DiagramFrameInput` is a labelled field (a [Field](#/field) with an [Input](#/input)) that changes something once you're done with it rather than on every key: Enter or leaving it commits (`onValueCommit`), Escape puts it back and goes no further, so the panel stays open. If the owner refuses the value, the field shows what it was.

## Accessibility

- The panel is named by its title, in every presentation: a drawer is a non-modal dialog, a push a named region with a back button, and a column part of the page. Sections are regions named by their titles.
- The trigger says whether the panel shows and which element it controls (`aria-expanded`, `aria-controls`). Focus moves into the panel when the trigger opens it, and back to the trigger when it closes.
- The bar's status is a polite live region, so a status that follows the board (where a machine is now) is heard without moving focus.
- Under a cover, the board and the panel are inert: nothing there can be focused or pressed until it goes.
- The drawer and the push keep to reduced motion (AdaptivePane's); nothing else moves.

## Props

### DiagramFrame

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | open where it's a column | Whether the panel shows. |
| `presentation` | `auto` | `auto` · `column` · `drawer` · `push` · `cover`. |
| `side` | `end` | `start` · `end` (logical). |
| `breakpoints` | `{ medium: 440, regular: 720 }` | The widths, px, the frame's size classes start at. |
| `className`, `style`, `ref`, … | — | The root `div`'s props. |

### DiagramFramePanel

| Prop | Default | Effect |
| --- | --- | --- |
| `title` | — (required) | Names and heads the panel; the trigger's text. |
| `backLabel` | `Board` | What a pushed panel's back button says. |
| `width` | 288 | Its width as a column (a drawer is at least 300). |
| `modal` | `false` | Whether a drawer dims and blocks the board. |
| `actions` | — | Things to do after the title (a ToolbarButton, a menu). |
| `className` | — | The pane's box. |

### DiagramFrameBar

| Prop | Default | Effect |
| --- | --- | --- |
| `children` | — | The status. |
| `trigger` | `<DiagramFrameTrigger />` | What opens the panel; `null` for nothing. |

### DiagramFrameInput

| Prop | Default | Effect |
| --- | --- | --- |
| `label` | — (required) | Its label. |
| `value` | — (required) | What it says now, and goes back to. |
| `onValueCommit(value)` | — (required) | The text, once changed and finished with. |
| `size` | `sm` | As on Input. Any other Input prop passes through. |

`DiagramFrameBoard`, `DiagramFrameCover` and `DiagramFrameSection` (with its `title`) take their element's props. `useDiagramFrame()` gives a part inside the frame `{ open, setOpen, presentation, sizeClass }`.

## Styling

Slots: `diagram-frame` (with `data-presentation`, `data-open`, `data-covered`, `data-size-class`), `diagram-frame-board`, `diagram-frame-bar`, `diagram-frame-status`, `diagram-frame-panel-body`, `diagram-frame-cover` and `diagram-frame-section`; the trigger is AdaptivePane's, marked `data-diagram-frame-trigger`, and the panel is an AdaptivePane (`adaptive-pane`, with its header parts).

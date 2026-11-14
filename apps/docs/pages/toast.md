# Toast

Brief, temporary feedback in two iOS looks: **banners**, cards with a title, a description and an action that pile up at an edge, and the dark **HUD** pill ("Password Copied") that appears for a moment. It is [UI SDK's Toast](https://ui-sdk.dev/docs/react/components/toast) with the kit's surfaces: UI SDK owns the queue, the timers, swiping, the stack's measurements and the announcements, so everything on its page applies here.

A toast is for news the person may miss without harm: it disappears, takes no focus and can't hold a decision. Use the HUD for a one-word confirmation of what the person just did ("Copied"), a banner for an event with detail or an Undo. Feedback that belongs to a place on the page (a field's error, a form that failed to save) goes inline, next to that place, in a [Field](https://blamy.github.io/ui/#/field) error or a message in the page. Anything that must be read or answered before going on (a destructive confirmation, a lost connection that blocks work) is an [AlertDialog](https://blamy.github.io/ui/#/dialog), not a toast.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/toast.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { ToastRegion, toast, hud } from '@/components/ui/toast'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { ToastRegion, toast, hud } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Composition

```text
ToastRegion
└── Toast
    ├── ToastIcon
    ├── ToastTitle
    ├── ToastDescription
    ├── ToastAction
    └── ToastClose
```

A region renders one `Toast` for each toast in its queue, newest first. Without children it renders the kit's toast for its `variant`, so most apps only place the region; pass a children function to arrange the parts yourself.

## Usage

Place a region once, near the root, then call `toast` from anywhere (an event handler, a fetch callback, outside React):

```tsx
import { ToastRegion, toast } from '@brett_lamy/ui'

<ToastRegion />                                   // once

toast('Message sent', { description: 'Delivered to Amelia.' })
toast.error('Couldn’t connect', { action: { label: 'Retry', onAction: retry } })

const id = toast.loading('Uploading…')            // a spinner; stays until updated
toast.update(id, { title: 'Uploaded', type: 'success' })

toast.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Couldn’t save' })
```

`toast()` returns the toast's id. A toast shown with the `id` of one that is still up **updates it in place**: its content changes, it is announced again and its timer restarts. `toast.update(id, …)` returns `false` once the toast has closed, so a late update never brings it back, and `toast.dismiss(id?)` closes one toast or all of them.

## Banners

Banners pile up at the region's edge: the newest card sits in front and the ones before it peek out behind, each a little smaller, three deep. Hover the pile, or move focus into it, and it spreads into a list; leave and it settles back. Timers pause while the pointer or focus is in the region, and while the page is hidden. Set `expanded` to keep the list spread out all the time, and `maxVisible` (default 5) for how many show at once: older ones wait, with their timers stopped, until there is room.

A banner can have a `description`, a `type` (`success`, `info`, `warning`, `error`, `loading`) that picks its icon, an `action`, a `cancel` button and an icon of its own in `data`: `toast('Sent', { data: { icon: 'paperplane' } })`. An action dismisses the toast unless it sets `dismiss: false`, and an action that returns a Promise keeps the toast open, and the button pending, until it settles. Swipe a banner toward the region's edge to dismiss it (and, unless the region is centered, toward the side it is aligned to), or press `Escape` on it. `dismissible: false` takes away the ✕, the swipe and `Escape`.

{% demo src="toast/banners" %}

## The HUD

The pill is a region of its own with `variant="hud"`, and `hud()` shows it. There is only ever one pill: calling `hud()` again while it is up replaces what it says, and its label morphs (the letters the two labels share stay put). It lasts 1.6 seconds and can't be swiped or closed. Its material is the `hud` color (`bg-hud` / `text-hud-foreground`), dark in both appearances as on iOS; set `--hud` and `--hud-foreground` to retheme it.

```tsx
import { ToastRegion, hud } from '@brett_lamy/ui'

<ToastRegion variant="hud" />                     // once, beside the banner region

hud('Password Copied', { type: 'success' })
hud('Pinned', { data: { icon: 'pushpin-fill' } })
```

{% demo src="toast/copy-hud" %}

## Position

`side` is `top` or `bottom` and `align` is `start`, `center` or `end` (start and end follow the writing direction). The kit's regions default to the bottom center; `offset` is the distance from the edges in px. From the bottom the pile grows upward, from the top downward.

```tsx
<ToastRegion side="top" align="end" offset={16} />
```

## A region of its own

`toast` and `hud` are the page's queues. A block, a panel or a demo that owns its feedback makes its own with `createToaster()` or `createHud()` and passes it to its region:

```tsx
const [toaster] = useState(() => createToaster())
const [hud] = useState(() => createHud())

<BLProvider>
  <Fields onCopy={(label) => hud(`${label} Copied`)} onSave={() => toaster.success('Saved')} />
  <ToastRegion toaster={toaster} side="top" />
  <ToastRegion variant="hud" toaster={hud.toaster} />
</BLProvider>
```

A region renders into its layer host, the nearest `BLProvider`'s root, so a framed app's toasts stay inside its frame and wear its theme; outside a `BLProvider` it sits at the edge of the page. `<ToastProvider toaster>` hands a queue to the parts below it, and `useToast()` reads the nearest one (the page's `toast` outside a provider): a part such as the [Composer](https://blamy.github.io/ui/#/composer) sends its own messages there. A banner `ToastRegion` inside the provider shows that same queue without being told, so `<ToastProvider toaster={t}><Composer /><ToastRegion /></ToastProvider>` keeps the pair together.

If the app also mounts UI SDK's `OverlayHost` (for `confirm()`), a `ToastRegion` you place takes over the page's toasts from it.

## Your own toast

Pass a children function to render each toast from the parts. It receives the toast (its `title`, `type`, `data`…) and its place in the stack; empty title, description and action parts show the toast's own text.

```tsx
<ToastRegion toaster={messages} aria-label="Messages">
  {(item) => (
    <Toast>
      <Avatar name={(item.data as { from: string }).from} size={28} />
      <div className="min-w-0 flex-1">
        <ToastTitle />
        <ToastDescription />
      </div>
      <ToastAction />
      <ToastClose />
    </Toast>
  )}
</ToastRegion>
```

## Accessibility and motion

- While it has toasts the region is a landmark named "Notifications" (set `aria-label` in your language). `F6`, or the region's `shortcut`, moves focus to the newest toast and back; `Tab` walks the toasts and their buttons; `Escape` dismisses the focused toast and focus moves to the next one, or back where it came from after the last.
- Toasts are announced once each through UI SDK's shared live regions, without taking focus: politely, or assertively for `error` (set `priority` to change that). An update in place, such as the HUD's new label, is announced again.
- Each toast is named by its title and described by its description. The ✕ is a button named "Close".
- Cards behind the front one hide their content while piled, but they are still in the page: moving focus to one spreads the pile so it is readable.
- Enter: the newest toast rises from the edge with a blur on a snappy spring (the pill grows from 85%); exit: a quicker fade back toward the edge, or on the way it was swiped; the cards behind move up a place on a spring. With `prefers-reduced-motion` toasts only fade, and the pile does not scale or slide.

## API

### `toast(message, options?)`

`toast(message, options)` or `toast(options)`; `toast.success`, `.info`, `.warning`, `.error` and `.loading` set the type; `toast.promise(promise, { loading, success, error })`; `toast.update(id, options)`; `toast.dismiss(id?)`. A queue from `createToaster({ duration? })` has the same methods.

| Option | Default | Effect |
| --- | --- | --- |
| `title` | the message | The main line. Any React node. |
| `description` | — | A second line (banners). |
| `type` | `default` | `success`, `info`, `warning`, `error` or `loading`: the icon and its color, and how it is announced. |
| `duration` | 5000 | Milliseconds before it closes; `Infinity` keeps it until dismissed (the default for `loading`). |
| `action` | — | `{ label, onAction, href?, dismiss? }`: one button (banners), a link with `href`. |
| `cancel` | — | `{ label, onCancel }`: a button that dismisses it. |
| `dismissible` | `true` | Whether the user can dismiss it: the ✕, swiping and `Escape`. |
| `data` | — | Anything else for rendering. The kit reads `data.icon`: an [Icon](https://blamy.github.io/ui/#/icons) name or any node. |
| `id` | generated | Show with the id of a toast that is up to update it in place. |
| `priority` | by type | `polite` or `assertive`. |
| `onDismiss(details)` | — | Called when it closes, with `details.reason` (`timeout`, `close-press`, `swipe`, `escape-key`, `action`, `imperative`); `details.cancel()` keeps it. |

### `hud(title, options?)`

Shows the pill or replaces what it says. Takes the same options except `id` (there is one pill); `duration` defaults to 1600 and `dismissible` to `false`. `createHud({ duration? })` makes a HUD of your own: call it like `hud`, and pass its `toaster` to a `variant="hud"` region.

### `<ToastRegion>`

Every prop of UI SDK's `ToastRegion` (`shortcut`, `pendingAnnouncement`, `container`, `render`…), plus `variant` and `offset`.

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `banner` | `banner` (the pile of cards) or `hud` (the pill). |
| `toaster` | the nearest `ToastProvider`'s queue, else `toast`; `hud.toaster` for a HUD region | The queue it shows. |
| `side` | `bottom` | `top` or `bottom`. |
| `align` | `center` | `start`, `center` or `end`. |
| `offset` | `24` | Distance from the edges in px. |
| `maxVisible` | `5` (`1` for a HUD) | How many toasts show at once. |
| `expanded` | `false` | Keep banners spread out as a list instead of piled. |
| `aria-label` | "Notifications" | The landmark's name. |
| `children` | the kit's toast | `(toast, item) => node`, built from `Toast` and its parts. |

### Parts

`Toast` (takes `variant`; inside a region it follows the region's), `ToastIcon` (the kit's Spinner while `loading`, else `data.icon`, else the glyph for the type; children replace it; a `span` that takes its element's props), `ToastTitle`, `ToastDescription`, `ToastAction` and `ToastClose` (the round ✕ without children, a labelled button with them) are UI SDK's parts with the kit's classes; each takes `className` and `render`.

### Data attributes

The region is `data-slot="toast-region"` with `data-side`, `data-align`, `data-variant` and `data-expanded` while spread. Each toast is `data-slot="toast"` with `data-type`, `data-variant`, `data-front` on the newest, `data-expanded`, `data-swiping`, `data-swipe-direction` once a swipe dismissed it, and `data-starting-style` / `data-ending-style` for its first frame and its exit. UI SDK writes the stack's measurements as CSS variables: `--toast-front-height`, `--toast-stack-height` and `--toast-count` on the region; `--toast-index`, `--toast-offset`, `--toast-height`, `--toast-swipe-x` and `--toast-swipe-y` on each toast.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `toastRegionVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
group/toasts outline-none data-[side=top]:top-[calc(env(safe-area-inset-top,0px)_+_var(--bl-toast-offset))] data-[side=top]:[--bl-toast-dir:1] data-[side=bottom]:bottom-[calc(var(--keyboard-inset,0px)_+_env(safe-area-inset-bottom,0px)_+_var(--bl-toast-offset))] data-[side=bottom]:[--bl-toast-dir:-1] data-[align=start]:start-[calc(env(safe-area-inset-left,0px)_+_var(--bl-toast-offset))] data-[align=end]:end-[calc(env(safe-area-inset-right,0px)_+_var(--bl-toast-offset))]
```

**`variant`** — default `banner`

| Value | Adds |
| --- | --- |
| `banner` (default) | `h-[calc(var(--toast-front-height)_+_clamp(0,var(--toast-count)_-_1,2)_*_14px)] w-[min(360px,calc(100%-32px))] transition-[height] duration-spring-smooth ease-s…` |
| `hud` | `w-max max-w-[calc(100%-32px)] *:flex *:flex-col *:items-center *:gap-2` |

### `toastVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
flex outline-none focus-visible:ring-2 focus-visible:ring-primary
```

**`variant`** — default `banner`

| Value | Adds |
| --- | --- |
| `banner` (default) | `[ 'absolute inset-x-0 z-[calc(100_-_var(--toast-index))] box-border h-(--toast-height) items-start gap-3 overflow-hidden rounded-card bg-card px-3.5 py…` |
| `hud` | `[ 'w-fit items-center gap-2 rounded-full bg-hud px-4 py-2.5 text-detail font-semibold text-hud-foreground shadow-hud backdrop-blur-xl backdrop-saturate…` |

### `toastIconVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
grid shrink-0 place-items-center
```

**`type`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-primary` |
| `info` | `text-primary` |
| `success` | `text-success` |
| `warning` | `text-warning` |
| `error` | `text-destructive` |
| `loading` | — |

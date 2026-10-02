# Toast

Brief, temporary feedback in two iOS looks: the dark **HUD** pill ("Password Copied") that appears for a moment in the middle of the bottom edge, and **banners** — cards with a title, a description and an action — that stack at an edge. Both come from one queue and one region built on react-aria's toast hooks, and every entrance, exit and restack runs on a spring.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/toast.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Toaster, toast, useToast } from '@/components/ui/toast'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Toaster, toast, useToast } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Mount one `<Toaster />` near the root, then call `toast` from anywhere:

```tsx
import { Toaster, toast } from '@brett_lamy/ui'

<Toaster />                                   // once

toast.hud('Password Copied', { tone: 'success' })          // the pill
toast('Message sent', { description: 'Delivered to Amelia.' })
toast.error('Couldn’t connect', { action: { label: 'Retry', onAction: retry } })

const id = toast.loading('Uploading…')        // a spinner, no timeout
toast.update(id, { title: 'Uploaded', tone: 'success' })
```

A toast shown with the `id` of a visible one **updates it in place** — its content changes and its timer restarts — instead of stacking a second one. `toast.update` keeps the timeout the toast was shown with (a `loading` toast has none, so it gets the default) unless you pass `{ timeout }`. HUDs do this automatically: there is only ever one pill, and copying again while it's up morphs its label (the letters the two labels share stay put).

{% demo src="toast/copy-hud" %}

## Banners

Banners pile up at the Toaster's edge the way Sonner's do: the newest card sits in front and the ones before it peek out behind, each a little smaller (up to three behind). Hover the pile, or move focus into it, and it spreads into a list; leave and it settles back. On a touch screen, tap the pile to spread it and tap anywhere else to put it away. Timers pause while it is spread. Set `expand` to keep the list spread out all the time.

Each banner can have a description, an icon, a tone and one action; pressing the action closes the banner unless its handler returns `false`. Swipe a banner sideways to dismiss it. From a `bottom` placement the pile grows upward; from `top` it grows downward.

{% demo src="toast/banners" %}

## A Toaster of its own

`toast` talks to the page's default queue. A component that owns its feedback — a block, a panel, a demo — makes a queue with `createToastQueue()` and renders its own `<Toaster queue={…} inline>`: `inline` positions the region absolutely inside the nearest positioned ancestor instead of fixed over the viewport. Children of a Toaster (and of `<ToastProvider queue>`) get that queue from `useToast()`.

```tsx
const [queue] = useState(() => createToastQueue())

<div style={{ position: 'relative' }}>
  <Toaster queue={queue} placement="bottom" inline>
    <Fields />           {/* useToast() → this queue */}
  </Toaster>
</div>
```

## Accessibility and motion

- The region is a landmark ("Notifications"), reachable with `F6`; each toast is an `alertdialog` whose content is announced as an alert — including when a HUD's label updates in place. When the last toast closes, focus returns to where it was.
- Enter: a short rise with a blur-in and a snappy spring (HUDs grow from 85%); exit: a quicker fade; the cards behind it move up a place on a spring.
- Cards behind the front one hide their content while piled, but they are still in the page: moving focus to one (Tab, or `F6` to the region) spreads the pile so it is readable.
- With `prefers-reduced-motion`, toasts fade in and out and the pile does not scale or slide; swiping is off.

## API

### `toast(title, options?)`

| Option | Default | Effect |
| --- | --- | --- |
| `variant` | `banner` | `hud` or `banner` (`toast.hud()` sets `hud`). |
| `description` | — | A second line (banners). |
| `icon` | from the tone | An [Icon](https://blamy.github.io/ui/#/icons) name or any node. |
| `tone` | `default` | `success`, `warning` or `destructive` color the icon. |
| `action` | — | `{ label, onAction }` — one button (banners). |
| `dismissible` | `true` | The close button (banners). |
| `id` | generated | Show with a visible toast's id to update it in place. |
| `timeout` | 1600 (HUD) / 5000 (banner) | Milliseconds before it closes; `0` keeps it until closed. |
| `onClose` | — | Called when it closes. |

`toast.hud`, `toast.success`, `toast.warning`, `toast.error` and `toast.loading` preset the variant or tone; `toast.update(id, patch)` patches a visible toast; `toast.dismiss(id?)` closes one or all. Every call returns the toast's id.

### `<Toaster>`

| Prop | Default | Effect |
| --- | --- | --- |
| `queue` | the default queue | A queue from `createToastQueue()`. |
| `placement` | `bottom` | `top`, `bottom`, `center`, `top-end`, `bottom-end`. |
| `inline` | `false` | Position inside the nearest positioned ancestor instead of fixed (portaled to `<body>`). |
| `offset` | `24` | Distance from the edge in px. |
| `expand` | `false` | Keep banners spread out as a list instead of piled (the pile still spreads on hover and focus). |
| `aria-label` | "Notifications" | The landmark's label. |

The region carries `data-slot="toaster"` and `data-placement`; the banner pile `data-slot="toast-stack"` (with `data-expanded` while spread) and each banner in it `data-slot="toast-layer"` and `data-index` (0 is the front); each toast `data-slot="toast"`, `data-variant` and `data-tone`, and `data-behind` while it is piled behind another.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `toastVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
outline-none data-[focus-visible]:ring-2 focus-visible:ring-2 focus-visible:ring-[var(--primary)]
```

**`variant`** — default `banner`

| Value | Adds |
| --- | --- |
| `hud` | `flex items-center gap-2 rounded-full bg-[rgba(30,30,32,.86)] px-4 py-2.5 text-detail font-semibold text-white shadow-[0_8px_30px_black] shadow-black/25 backdro…` |
| `banner` (default) | `flex w-[min(360px,calc(100vw-32px))] items-start gap-3 rounded-2xl bg-card px-3.5 py-3 text-foreground shadow-[0_10px_34px_--alpha(black/16%),0_0_0_.5px_var(--…` |

### `toastIconVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
grid shrink-0 place-items-center
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-primary` |
| `success` | `text-success` |
| `warning` | `text-warning` |
| `destructive` | `text-destructive` |

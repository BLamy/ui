# Haptics

One engine, three calls — the same API surface as `UIFeedbackGenerator`:

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Haptics, HapticIndicator } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/haptics.json{% endcommand %}

Adds `@/components/ui/haptics.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import { Haptics, HapticIndicator } from '@/components/ui/haptics'
```
{% endtab %}
{% endtabs %}

```js
Haptics.impact('light' | 'medium' | 'heavy')
Haptics.selection()           // A–Z scrub · pickers · tabs
Haptics.notification('success' | 'warning' | 'error')
Haptics.on(meta => ...)       // observe events (drives the pulse indicator)
Haptics.enabled = false       // the user's setting, saved on this device
```

## Engines, by platform

| Platform | Path | What you get |
| --- | --- | --- |
| Android / Chrome | `navigator.vibrate(pattern)` | every call, as its pattern — taps, drags and momentum |
| iOS 18+ (any iOS browser — all are WebKit) | a hidden `<input type="checkbox" switch>` | one system tick per tap or key press; 17.4–17.x has the switch but may not tick |
| macOS Safari | the same switch | a trackpad click on Force Touch trackpads, where Safari plays one |
| Everything else | none | calls are still observable through `Haptics.on` |

`Haptics.engine` reports the live path; it's printed in the playground and in the demo's Settings screen. Nothing runs at import: the engine picks its path, adds its listeners and (on Safari) creates its one hidden switch the first time you call it.

## How iOS works

WebKit has no Vibration API. What it has is the switch control: toggling an `<input type="checkbox" switch>` during a user gesture plays the system's selection haptic. The engine keeps a single visually hidden, `aria-hidden`, inert `<label><input switch></label>` at the end of `<body>` and clicks the label while the page is handling a trusted gesture.

- **A tick needs a live gesture.** Calls made inside a `click`, `keydown`/`keyup`, a native `input`/`change`, a mouse or trackpad press, or the release that ends a drag tick at once.
- **Press-time calls are held for the click.** react-aria fires `onPress` on `pointerup`, just before the browser's `click`. Those calls wait for the click (or the drag's release) and play there. Anything still waiting after ~350ms is dropped rather than played late.
- **No ticks mid-drag.** A pointermove, a scroll or a momentum frame isn't a gesture, so scrubbing `IndexBar`, dragging a `Slider`, reordering rows, crossing a swipe threshold or dragging a sheet is silent on iOS. On Android each of those still vibrates. A native `<input type="range">` is the exception: its `input` events can tick.
- **One kind of tick.** iOS has no duration or intensity control. `impact` and `selection` are one tick each; a `notification` becomes two or three ticks spaced like its Android pattern, while the gesture lasts.
- **One tick per tap.** Several calls in one tap (a component and your handler) merge into one.
- **Nothing is intercepted.** No overlays, no pointer capture changes, no forwarded or cancelled events, no main-thread blocking. The only events the engine stops are its own hidden switch's `click`/`input`/`change`, so your listeners and react-aria never see them. The switch is inert, so it can't take focus, scroll the page or close the keyboard.

## Turning haptics off

`Haptics.enabled` is the user's setting. It's saved in `localStorage` and read on first use; when it's off, calls are no-ops and `Haptics.on` sees nothing. The playground's first row is that setting.

## Playground

On Android every detent vibrates. In Safari on an iPhone, or on a Mac with a Force Touch trackpad, taps tick and so does the native haptic slider; the custom drags are silent there.

{% demo src="haptics/playground" %}

## Examples

### Success and error on submit

Outcomes get a notification pattern. Fire it where you learn the result, inside the press, so iOS still counts it as part of the tap.

{% demo src="haptics/verify-code" %}

### Observe every event

`Haptics.on` sees every call, from your code and from the components. `HapticIndicator` is the pill the Contacts demo uses to show the last event and the live engine.

{% demo src="haptics/event-log" %}

### Controls that tick on their own

`Segmented`, `Switch`, `Slider` and `TabView` already call `Haptics`, so a settings screen built from them needs no wiring.

{% demo src="haptics/built-in-feedback" %}

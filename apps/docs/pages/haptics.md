# Haptics

One engine, three calls — the same API surface as `UIFeedbackGenerator`:

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx lineNumbers="false"
import '@brett_lamy/ui/styles.css'

import { Haptics, HapticIndicator } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/haptics.json{% endcommand %}

Adds `@/components/ui/haptics.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx lineNumbers="false"
import { Haptics, HapticIndicator } from '@/components/ui/haptics'
```
{% endtab %}
{% endtabs %}

```js
Haptics.impact('light' | 'medium' | 'heavy')
Haptics.selection()                       // A–Z scrub · pickers · tabs
Haptics.notification('success' | 'warning' | 'error')
Haptics.on(meta => ...)                   // observe events (drives the pulse indicator)
```

## Engines, by platform

| Platform | Path |
| --- | --- |
| Android / Chrome | native `navigator.vibrate()` |
| iOS Safari 18+ | `ios-vibrator-pro-max@3.0.3` — hidden switch toggles |
| macOS Safari | same polyfill — the trackpad's Taptic Engine clicks |
| Everything else | no vibration API |

The polyfill is a package dependency and boots **at import time**, matching its recommended setup, so it can wrap the DOM before the first tap. `Haptics.engine` reports the live path; it's printed below and in the demo's Settings screen.

## iOS 18.4+ rules

- Only a real **click** grants vibration, and the grant lasts about a second.
- For movable controls, the polyfill layers a native switch over the interaction surface, listens to pointer events in capture, disables pointer capture, and flips the switch direction or position under the finger while dragging.
- Patterns longer than 1s would need main-thread blocking; BL UI's longest pattern is ~150ms.

## Playground

The set below recreates the **vibrator.dev** homepage. In Safari on an iPhone or MacBook you'll feel each detent; drag slower if you feel nothing.

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

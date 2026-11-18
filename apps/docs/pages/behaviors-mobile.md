# Mobile

On a phone the page lays out for a screen people don't fully see: the on-screen keyboard covers its bottom, iOS pans the page to keep a field in view, a notch and the home indicator take its edges, and there is a finger where a desktop has a mouse that can hover. UI SDK's mobile helpers measure all of it: `bindViewport` follows the keyboard, the visible viewport and the safe areas, `bindAvoidKeyboard` keeps a bar above the keyboard, `createPointerKind` tells a finger from a mouse, and `inputHints` picks the right keyboard for a field. They work inside a primitive or on their own element. The upstream reference is [Mobile](https://ui-sdk.dev/docs/core/mobile).

```ts
import { bindViewport, bindAvoidKeyboard, createPointerKind, pointerKindOf, inputHints, type ViewportState } from '@brett_lamy/ui/sdk/core'
import { usePreference } from '@brett_lamy/ui/sdk/react/preferences'
```

Layout is a different question. BL UI's containers adapt to their **own** box, never the viewport, through size classes (the kit's `bindSizeClass` and size-class scopes, from `@/lib/size-class` and `@/lib/container`): a phone frame, a window or a split column behaves like a small screen whatever the device. That is on [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit), with the platform's back gesture (`bindBack`).

## The keyboard and the viewport

`bindViewport(el, { onChange })` follows the visual viewport on an element, usually `document.documentElement`, and reports each change (and once at the start). `viewport.keyboard` is the keyboard's height while a field has focus; `viewport.keyboardInset` is how much of the page's bottom it covers, for placing things (less while iOS pans the page, 0 where the browser resizes the page for the keyboard instead); `width`, `height`, `offsetTop` and `offsetLeft` describe the part of the page on screen, and `safeArea` holds the insets. For CSS the element gets:

| Variable or attribute | What it holds |
| --- | --- |
| `--keyboard-inset` | How much of the page's bottom the keyboard covers |
| `--visual-viewport-width`, `--visual-viewport-height` | The part of the page on screen (the height shrinks above the keyboard) |
| `--visual-viewport-top` | How far the page is panned down to show a field |
| `data-keyboard` | Present while the keyboard is open |

The kit's toast region already reads `--keyboard-inset` (`bottom-[calc(var(--keyboard-inset,0px)_+_env(safe-area-inset-bottom,0px)_+_…)]`), so bottom toasts rise above the keyboard on any page that binds the viewport.

`bindAvoidKeyboard(el)` is for one element the browser won't keep in view: a status pill under a note, the buttons beside a field, a toolbar fixed to the bottom. While the keyboard is open it lifts the element by as much of it as the keyboard covers, through its `translate` (your own translate is kept and put back by the cleanup), and sets `data-keyboard`. Leave `translate` without a transition so it doesn't trail behind while the page scrolls, and bind a wrapper with bottom padding for a gap above the keyboard.

{% demo src="behaviors-mobile/avoid-keyboard" %}

```tsx
const lift = useRef<HTMLDivElement>(null)
useEffect(() => (lift.current ? bindAvoidKeyboard(lift.current) : undefined), [])
useEffect(() => bindViewport(document.documentElement, { onChange: setViewport }), [])
```

Open this page on a phone and tap the list: the pill rises with the keyboard. On a desktop the numbers stay at 0.

Two phone rules the demo follows: give fields at least 16px text (`text-callout`), or iOS zooms into a field when it takes focus; and safe-area insets are 0 unless the page draws under them with `viewport-fit=cover` in its viewport meta tag. iOS keeps reporting the bottom inset while the keyboard covers the home indicator, so drop bottom padding then: `pb-[env(safe-area-inset-bottom)] data-keyboard:pb-0`.

## The right keyboard

A phone picks its keyboard from the field: `inputmode` chooses the keys and `enterkeyhint` the Return key. `inputHints(kind)` fills those in, with `autocomplete`, `autocapitalize` and `spellcheck`, for a kind of field (an email, a one-time code, a search). It is on [Focus and keys](https://blamy.github.io/ui/#/behaviors-focus).

## A finger or a mouse

`createPointerKind()` reports whether the main pointer is a finger or a mouse (`pointer`: `"fine"`, `"coarse"`, `"none"`) and whether it can hover (`hover`: `"hover"` or `"none"`), plus `anyPointer` and `anyHover` for every pointer attached (a trackpad on a tablet). Read it like any UI SDK preference, with `usePreference`:

{% demo src="behaviors-mobile/pointer-kind" %}

```tsx
const pointerKind = createPointerKind() // once, at module level in the browser

function Shipping() {
  const { hover } = usePreference(pointerKind) // "hover", "none", or "unknown" before hydration
  const hovers = hover === 'hover'
  return <button onPointerEnter={hovers ? open : undefined} onClick={toggle}>…</button>
}
```

It is for behavior and content: opening on tap where nothing can hover, or saying "tap" instead of "hover". Style with the media queries themselves (`pointer-coarse:h-12`, `@media (hover: hover)`, and Tailwind's `hover:`, which already skips touch), because they are right from the first paint, while the preference is `"unknown"` in the server render and the first browser render.

To render the right content from the start on the server, create the pointer kind per request with a guess: `createPointerKind({ initial: pointerKindOf(request.headers.get('Sec-CH-UA-Mobile')) })`, and send `initial` to the browser so hydration matches. Chromium sends the header; Safari and Firefox don't, so content must read sensibly while `"unknown"`. Send `Vary: Sec-CH-UA-Mobile` if a cache stores the page.

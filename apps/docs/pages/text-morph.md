# TextMorph

A label that morphs into the next one. "Continue" becomes "Confirm": the letters the two words share slide to their new places, the rest blur out and in, and the box springs to the new width. [Button](https://blamy.github.io/ui/#/button) already wraps a plain-text child in `TextMorph`, so most labels morph with no extra code; use `TextMorph` directly for other text that changes: a status line, a heading, a tab title. For numbers use [NumberMorph](https://blamy.github.io/ui/#/number-morph); for icons [IconSwap](https://blamy.github.io/ui/#/icon-swap).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/text-morph.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { TextMorph } from '@/components/ui/text-morph'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { TextMorph } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Pass the text as a single string child; changing it runs the morph. At rest it renders as one plain text run (so kerning, selection and screen readers see ordinary text); the per-letter layer exists only for the ~0.7s a morph runs. Letters are matched by character and occurrence, so the second "o" of one word pairs with the second "o" of the next.

{% demo src="text-morph/labels" %}

```tsx
<h2><TextMorph>{step === 0 ? 'Continue' : 'Confirm'}</TextMorph></h2>

<Button onPress={next}>{label}</Button>   {/* morphs on its own */}
```

## Good to know

- `children` must be a string. A Button whose children are anything else (an icon next to text, an array) does not morph.
- There is no morph for multi-line text: if either the old or new text contains a newline, or the user prefers reduced motion, it swaps at once.
- The morph measures the rendered run, so the element needs the final font; a web font that loads late is re-measured once `document.fonts` is ready.
- While morphing the element becomes `inline-block` with its width springing; at rest it is `display: contents`, so the text sits in whatever element you put around it.

## Accessibility

The resting text is the real text node. During a morph the animated letters are `aria-hidden` and the real text stays in place (hidden visually) for assistive technology, so a screen reader reads the new label, not its letters. If the change is important, announce it (`aria-live` or `role="status"`) on the parent; `TextMorph` does not add a live region.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `children` | — | The text (a `string`). Changing it starts a morph. |
| `className` / `style` | — | Merged onto the root `span`. |

## Styling

The root is `data-slot="text-morph"`, with `data-morphing` while a morph runs. Font, size and colour are inherited, so style the parent.

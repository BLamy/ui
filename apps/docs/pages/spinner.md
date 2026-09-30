# Spinner

The iOS activity indicator: eight spokes that fade from faint to full and turn in eight discrete steps, not a smooth spin. It is a small SVG drawn in `currentColor`, so it takes the colour of the text around it. Use it for an indeterminate wait inside a button, a row or a toolbar; for a bar use [Progress](https://blamy.github.io/ui/#/progress), for a ring with a value use [ProgressRing](https://blamy.github.io/ui/#/progress-ring), and for content that is loading use [Skeleton](https://blamy.github.io/ui/#/skeleton).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/spinner.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Spinner } from '@/components/ui/spinner'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Spinner } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

`spin` turns the rotation on; without it the spokes stay still. `size` is the width and height in px. Mounting the spinner is an event, so it grows in (scale and opacity) on the snappy spring instead of popping in; under reduced motion it appears at once.

{% demo src="spinner/states" %}

```tsx
<Spinner spin size={16} />
<div className="text-primary"><Spinner spin size={32} /></div>
```

## In a button

Render the spinner only while the work runs, next to the label, and disable the button so a second press cannot double-submit. The spinner is decorative, so announce the result somewhere: here a `role="status"` line.

{% demo src="spinner/button-loading" %}

## Accessibility

The SVG is `aria-hidden`, so it says nothing to assistive technology. Put the state in text: change the button label ("Saving…"), or mark the loading region `aria-busy="true"` with a label. The stepped rotation keeps turning under `prefers-reduced-motion`; render it only while something is pending.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `spin` | `false` | Start the stepped rotation (`animate-[blSpin_.75s_steps(8)_infinite]`). |
| `size` | `22` | Width and height in px. |
| `className` / `style` | — | Merged onto the `svg`; set the colour with a `text-*` class or `color`. |

## Styling

The root is `data-slot="spinner"`. The spokes use `fill="currentColor"` with opacities 1/8 to 8/8, so the colour comes from the parent. The spin keyframes (`blSpin`) ship with BL UI's stylesheet.

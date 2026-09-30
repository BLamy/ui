# QRSvg

A real, scannable QR code rendered as SVG. `QRSvg` encodes text in byte mode (UTF-8) with an automatic version and any of the four error-correction levels, and draws it as two `<path>`s: one for the data modules, one for the three finder patterns. Use it to share a link, pair a device or join a Wi-Fi network (`WIFI:S:…;T:WPA;P:…;;`). The encoder in `lib/qr.ts` is included with the component, so it needs no dependencies.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/qr-svg.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { QRSvg } from '@/components/ui/qr-svg'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { QRSvg } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Pass the text as `value`. By default modules are iOS-style rounded dots with rounded finder eyes, drawn in `currentColor`. A scanner needs a light quiet zone around the code: put the SVG on a light card with padding, or give it a `margin` (in modules) and a `background`.

{% demo src="qr-svg/share" %}

```tsx
<div className="rounded-card bg-white p-4 text-black">
  <QRSvg value="https://example.com/albums/summer-2026" title="Open shared album" />
</div>

<QRSvg value={wifi} level="Q" rounded={false} margin={2} background="white" color="black" />
```

## Choices that affect scanning

- **Contrast.** Dark modules on a light ground scan best; `color` and `background` take any CSS colour. Some scanners do not read inverted (light-on-dark) codes, so keep the card light even in a dark theme, as the demo does.
- **Level.** `level` is `M` by default. L recovers about 7% of damage, M 15%, Q 25%, H 30%. Higher levels make denser codes, so use Q or H only if the code may be covered (a logo overlay) or worn.
- **Rounded.** `rounded` (default on) fills about 85% of each cell and keeps the finder rings solid, so the code stays scannable; `rounded={false}` draws square modules, merging horizontal runs into single rectangles with crisp edges.
- **Size.** The code scales to `size` (168px by default) and its version grows with the text, so a long URL is denser at the same size.
- **Quiet zone.** `margin` defaults to `0`; scanners want one to four modules of light space around the code.

## Accessibility

Without `title` the SVG is `aria-hidden`, as it is a machine-readable image. Give it a `title` when the code is the only way to get something ("Open shared album") and it becomes `role="img"` with a `<title>`; also offer the same information as text or a link, since not everyone can scan.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | `''` | Text to encode. `seed` is a deprecated alias. |
| `size` | `168` | Rendered width and height in px. |
| `level` | `M` | Error correction: `L`, `M`, `Q` or `H`. |
| `margin` | `0` | Quiet zone in modules, added inside the SVG. |
| `color` | `currentColor` | Colour of the dark modules. |
| `background` | none | Background fill of the whole code, including the margin. |
| `rounded` | `true` | Rounded modules and finder eyes; `false` for square. |
| `title` | — | Accessible name; adds `role="img"` and a `<title>`. |
| `className` / `style` | — | Merged onto the `svg`. |

## Styling

The root is `data-slot="qr-svg"` (`display: block`); the paths are `data-part="modules"` and `data-part="finders"`. Text too long for the largest code (version 40) makes the encoder throw while rendering, so limit or validate what you pass.

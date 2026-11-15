# Disclosure

Show-and-hide sections on UI SDK's `Collapsible` and `Accordion`: a trigger row with a turning chevron and a panel whose height springs open while its content fades down into place. A `Disclosure` on its own is one collapsible section (shadcn's and UI SDK's **Collapsible**); a `DisclosureGroup` is an **accordion** of items that share their open state (UI SDK's `Accordion`, with the `DisclosureGroup` part names: `Accordion` → `DisclosureGroup`, `AccordionItem` → `DisclosureGroupItem`, and so on). Use it for FAQs, settings groups and "show more" blocks. For content that swaps rather than expands, use [Tabs](https://blamy.github.io/ui/#/tabs); for a static grouped panel, [Card](https://blamy.github.io/ui/#/card).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/disclosure.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  DisclosureGroup, DisclosureGroupItem, DisclosureGroupHeader,
  DisclosureGroupTrigger, DisclosureGroupPanel,
} from '@/components/ui/disclosure'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  DisclosureGroup, DisclosureGroupItem, DisclosureGroupHeader,
  DisclosureGroupTrigger, DisclosureGroupPanel,
} from '@brett_lamy/ui/disclosure'
```
{% endtab %}
{% endtabs %}

The two families have the same look:

| Family | Parts | Built on |
| --- | --- | --- |
| One section | `Disclosure`, `DisclosureHeader`, `DisclosureTrigger`, `DisclosurePanel` | UI SDK `Collapsible` |
| A group | `DisclosureGroup`, `DisclosureGroupItem`, `DisclosureGroupHeader`, `DisclosureGroupTrigger`, `DisclosureGroupPanel` | UI SDK `Accordion` |

## A group

Each item needs a `value`; the group's value is the array of open items. By default one item is open at a time, and `defaultValue` opens some at first. Put each trigger in a `DisclosureGroupHeader`, the heading that places the item in the page's outline. A `disabled` item stays as it is and dims, but stays in the tab order so it can be found.

{% demo src="disclosure/faq" %}

```tsx
<DisclosureGroup defaultValue={['billing']}>
  <DisclosureGroupItem value="billing">
    <DisclosureGroupHeader>
      <DisclosureGroupTrigger>When am I billed?</DisclosureGroupTrigger>
    </DisclosureGroupHeader>
    <DisclosureGroupPanel>On the same day each month.</DisclosureGroupPanel>
  </DisclosureGroupItem>
  …
</DisclosureGroup>
```

`collapsible={false}` keeps the open item open until another one replaces it.

## Inset and controlled

`variant="inset"` turns the group into an iOS grouped card: Card's own surface (`cardVariants()`, the radius a List section uses too) with 16px side padding; the rows keep their hairline dividers. `multiple` lets several items stay open. `value` / `onValueChange` make the group controlled — an array of item values, so "Expand all" is `setOpen(ids)`. `onValueChange(value, details)` gets the reason (`trigger-press`, `find-in-page` or `imperative`), and an item's own `onOpenChange(open, details)` runs first and can `details.cancel()` the change.

{% demo src="disclosure/settings" %}

```tsx
const [open, setOpen] = useState(['privacy'])

<DisclosureGroup variant="inset" multiple value={open} onValueChange={setOpen}>
  <DisclosureGroupItem value="privacy">
    <DisclosureGroupHeader>
      <DisclosureGroupTrigger>Privacy</DisclosureGroupTrigger>
    </DisclosureGroupHeader>
    <DisclosureGroupPanel>…</DisclosureGroupPanel>
  </DisclosureGroupItem>
</DisclosureGroup>
```

To open items from outside the tree, pass a controller: `const faq = createAccordionController()`, `<DisclosureGroup controller={faq}>`, then `faq.open('billing')`, `faq.openAll()` (with `multiple`) or `faq.closeAll()`.

## A single disclosure

`Disclosure` owns its own state: `defaultOpen`, or `open` with `onOpenChange(open, details)`. `createCollapsibleController()` drives it from outside (`open()`, `close()`, `toggle()`).

```tsx
<Disclosure defaultOpen>
  <DisclosureHeader>
    <DisclosureTrigger>Advanced options</DisclosureTrigger>
  </DisclosureHeader>
  <DisclosurePanel>…</DisclosurePanel>
</Disclosure>
```

`DisclosureHeader` is the same heading a group item has (an `h3`, `render={<h2 />}` for another level). Leave it out when the section is not part of the page's outline, such as a "Show more" inside a form.

## Accessibility

UI SDK wires the trigger to the panel: the trigger is a button with `aria-expanded`, and `aria-controls` while its panel is mounted; the panel is a region labelled by its trigger; Enter or Space toggles, and closing a panel with focus inside it returns focus to the trigger. In a group each trigger sits in a heading — an `h3` by default; `render={<h4 />}` on the header changes the level. Closed panels stay in the page, hidden until found (`hiddenUntilFound`, on by default here), so the browser's find in page opens the section that holds a match. Name each trigger with its visible text; there is nothing else to label. Motion is skipped under `prefers-reduced-motion`.

## Props

### DisclosureGroup

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default`: rows with hairline dividers, no container. `inset`: a rounded card-colored group with side padding. |
| `multiple` | `false` | Let more than one item be open. |
| `value` / `defaultValue` / `onValueChange` | — | Controlled / initial array of open item values. `onValueChange(value, details)`. |
| `collapsible` | `true` | `false` keeps the open item open until another replaces it. |
| `disabled` | `false` | Disable every item. |
| `keepMounted` | `false` | Keep closed panels' content mounted (hidden), to keep their state. |
| `hiddenUntilFound` | `true` | Keep closed panels findable by the browser's find in page. |
| `controller` | — | From `createAccordionController()`. |

### DisclosureGroupItem

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | The item's key in the group. |
| `disabled` | `false` | Disables the item's trigger (dimmed, still focusable). |
| `onOpenChange` / `onOpenChangeComplete` | — | `(open, details)` before the group's `onValueChange` (cancelable), and `(open)` after the panel's animation. |

### Disclosure

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange` | — | Controlled / initial state. `onOpenChange(open, details)`. |
| `onOpenChangeComplete` | — | `(open)`, after the panel's animation. |
| `disabled` | `false` | Disables the trigger. |
| `controller` | — | From `createCollapsibleController()`. |

### Triggers, headers and panels

| Part | Notes |
| --- | --- |
| `DisclosureTrigger` / `DisclosureGroupTrigger` | A button; `children` are the label, and the chevron is added after it. It reaches 8px past the text on each side (`-mx-2 px-2`) so its focus ring has room while the label stays aligned with the panel. `className` may be a function of state (`({ open }) => …`). |
| `DisclosureHeader` / `DisclosureGroupHeader` | The heading around a trigger, an `h3` unless you `render` another. |
| `DisclosurePanel` / `DisclosureGroupPanel` | `keepMounted`, `hiddenUntilFound` (default `true`). `className` goes on the panel, not on the inner padded wrapper (14px of bottom padding). |

All parts accept `className` (merged last), `style` and `render`.

## Styling

Slots are UI SDK's: `data-slot="collapsible"`, `collapsible-trigger`, `collapsible-panel` (and the kit's `disclosure-header`) for a `Disclosure`, and `accordion`, `accordion-item`, `accordion-header`, `accordion-trigger`, `accordion-panel` for a group. The item and each of its parts carry `data-open` or `data-closed`, and `data-disabled`; hover, press and keyboard focus are the native `hover:`, `active:` and `focus-visible:`. The item (or the `Disclosure`) is a `group/disclosure`, which is how the chevron turns 90° — target it the same way in your own children (`group-data-open/disclosure:…`). The panel's height transitions from UI SDK's measured `--collapsible-panel-height` / `--accordion-panel-height`, from and to zero under `data-starting-style` and `data-ending-style`, and the panel is a `group/disclosure-panel` so its content can fade with it.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `disclosureGroupVariants`

Defined in `@/components/ui/disclosure`. Base classes:

```text
flex flex-col
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `inset` | `cn(cardVariants(), 'px-4')` |

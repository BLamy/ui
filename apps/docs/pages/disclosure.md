# Disclosure

Show-and-hide sections built on react-aria's `Disclosure`: a trigger row with a turning chevron and a panel whose height springs open while its content fades down into place. `DisclosureGroup` (exported as `Accordion`) groups several of them so they share expanded state, and a single `Disclosure` on its own is one collapsible section. Use it for FAQs, settings groups and "show more" blocks. For content that swaps rather than expands, use [Tabs](https://blamy.github.io/ui/#/tabs).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/disclosure.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/disclosure'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

The shadcn names are aliases of the same parts: `Accordion` = `DisclosureGroup`, `AccordionItem` = `Disclosure`, `AccordionTrigger` = `DisclosureTrigger`, `AccordionContent` = `DisclosurePanel`.

## Accordion

Each item needs an `id`; the group tracks open items by id. By default one item is open at a time, and `defaultExpandedKeys` opens one at first. A disabled item (`isDisabled`) stays closed, dims and is skipped by press.

{% demo src="disclosure/faq" %}

```tsx
<Accordion defaultExpandedKeys={['billing']}>
  <AccordionItem id="billing">
    <AccordionTrigger>When am I billed?</AccordionTrigger>
    <AccordionContent>On the same day each month.</AccordionContent>
  </AccordionItem>
  …
</Accordion>
```

## Inset and controlled

`variant="inset"` turns the group into an iOS grouped card (rounded, card color, 16px side padding); the rows keep their hairline dividers. `allowsMultipleExpanded` lets several items stay open. `expandedKeys` / `onExpandedChange` make the group controlled — a `Set` of ids, so "Expand all" is `new Set(ids)`.

{% demo src="disclosure/settings" %}

```tsx
const [open, setOpen] = useState<Set<Key>>(new Set(['privacy']))

<DisclosureGroup variant="inset" allowsMultipleExpanded expandedKeys={open} onExpandedChange={setOpen}>
  <Disclosure id="privacy">
    <DisclosureTrigger>Privacy</DisclosureTrigger>
    <DisclosurePanel>…</DisclosurePanel>
  </Disclosure>
</DisclosureGroup>
```

## A single disclosure

Outside a group, `Disclosure` owns its own state: `defaultExpanded`, or `isExpanded` with `onExpandedChange`.

```tsx
<Disclosure defaultExpanded>
  <DisclosureTrigger>Advanced options</DisclosureTrigger>
  <DisclosurePanel>…</DisclosurePanel>
</Disclosure>
```

## Accessibility

react-aria wires the trigger to the panel: the trigger is a button with `aria-expanded` and `aria-controls`, the panel is a `role="group"` region labelled by it, and Enter or Space toggles. Collapsed panels use `hidden="until-found"`, so the browser's find-in-page opens the section that contains a match. The trigger is wrapped in a heading — level 3 by default, set `level` on `DisclosureTrigger` to fit your outline — so screen-reader users can navigate by heading. Name each trigger with its visible text; there is nothing else to label. Motion is skipped under `prefers-reduced-motion`.

## Props

### DisclosureGroup / Accordion

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default`: rows with hairline dividers, no container. `inset`: a rounded card-colored group with side padding. |
| `allowsMultipleExpanded` | `false` | Let more than one item be open. |
| `expandedKeys` / `defaultExpandedKeys` | — | Controlled / initial set of open item ids. |
| `onExpandedChange` | — | Called with the new `Set` of ids. |
| `isDisabled` | `false` | Disable every item. |

### Disclosure / AccordionItem

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | — | The item's key in a group. |
| `isExpanded` / `defaultExpanded` / `onExpandedChange` | — | State for a disclosure used on its own. |
| `isDisabled` | `false` | Disables the trigger (dimmed, not pressable). |

### DisclosureTrigger and DisclosurePanel

| Prop | Default | Effect |
| --- | --- | --- |
| `level` (trigger) | `3` | Heading level of the trigger's wrapper. |
| `children` | — | Trigger label; the chevron is added after it and is not configurable. |
| `className` | — | Merged last on the trigger button / on the panel (not on the inner padded wrapper, which adds 14px of bottom padding). |

## Styling

Slots: `data-slot="disclosure-group"`, `disclosure`, `disclosure-trigger`, `disclosure-panel`. React-aria state attributes are on each: `data-expanded` and `data-disabled` on the item, plus `data-pressed`, `data-focus-visible` on the trigger. The item is a `group/disclosure`, which is how the chevron turns 90° and the panel content fades; target it the same way in your own children (`group-data-expanded/disclosure:…`). The panel height transitions from react-aria's `--disclosure-panel-height` variable.

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
| `inset` | `overflow-hidden rounded-panel bg-card px-4` |

# WorkbenchTheme

A `div` that opens the Workbench's `workbench` [theme scope](https://blamy.github.io/ui/#/theming) and gives its subtree the Workbench's base look: the scope's background and foreground, the sans font, antialiasing. The scope is dark-first (an IDE palette) with a light counterpart in the Apple and Codex-desktop style. Wrap transcript, [Composer](https://blamy.github.io/ui/#/composer), [MessageScroller](https://blamy.github.io/ui/#/message-scroller) and [Conversation](https://blamy.github.io/ui/#/conversation) parts in it when you use them outside a full workbench shell, which opens the same scope itself.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/workbench-theme.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  WorkbenchTheme, useWorkbenchAppearance,
} from '@/components/ui/workbench-theme'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { WorkbenchTheme, useWorkbenchAppearance } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

Inside, everything uses the ordinary shadcn utilities (`bg-card`, `text-muted-foreground`, `border-border`); the scope only decides what those resolve to. To set your own palette or accent on any region, use `ThemeScope` from the [theming guide](https://blamy.github.io/ui/#/theming).

## Usage

```tsx
<WorkbenchTheme className="p-4">
  <MessageScroller items={items} threadKey="t1" />
</WorkbenchTheme>

<WorkbenchTheme appearance="light" tint="#30d158">…</WorkbenchTheme>
```

## Appearance and tint

The appearance is the explicit `appearance` prop, else the ambient `AppearanceProvider` value (which is also how the `dark` class on `<html>` counts), else **dark**; unlike a plain `ThemeScope`, it never falls back to light. `tint` replaces `--primary` and `--ring` inside the scope. Two scopes with explicit appearances sit side by side below; the chip is `useWorkbenchAppearance()` read from inside.

{% demo src="workbench-theme/scopes" %}

## useWorkbenchAppearance

```tsx
const appearance = useWorkbenchAppearance()        // 'light' | 'dark'
const forced = useWorkbenchAppearance('light')     // the argument wins
```

It returns the explicit argument, else the resolved appearance of the nearest `WorkbenchTheme` (or workbench shell), else the ambient `AppearanceProvider`, else `dark`. Use it for third-party renderers that take the theme as a prop, such as a diff viewer or a syntax highlighter, where CSS variables do not reach. The nearest-root value is kept in a context private to the workbench, so a nested `BLProvider` does not change it.

`WorkbenchAppearanceProvider` is that context's provider. `WorkbenchTheme` already renders it with the resolved appearance, so you only need it to publish an appearance for a subtree that is not inside a `WorkbenchTheme`.

## Accessibility

It renders a plain `div` with no role. It sets `antialiased` and the theme's colors, so check contrast if you override `tint`: text on `--primary` uses `--primary-foreground`, which a custom tint does not change.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `appearance` | ambient, else `dark` | `light` or `dark`; puts the matching class and `color-scheme` on the root. |
| `tint` | the theme's primary | Accent: sets `--primary` and `--ring` for the subtree. |
| `className` / `style` | | Merged after the scope's (`style` wins). |
| …`HTMLAttributes<HTMLDivElement>` | | Every other `div` prop passes through. |

## Styling

The root carries `data-slot="workbench-theme"` and `data-theme-scope="workbench"`, plus the `light` or `dark` class, and the base classes `bg-background font-sans text-foreground antialiased`. Its palette is the `workbench` scope in the bl-theme (`[data-theme-scope="workbench"]` rules); change the look with plain CSS on that selector, or override variables for one region with `style` or a nested `ThemeScope`.

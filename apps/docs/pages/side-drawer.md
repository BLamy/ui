# SideDrawer

One inspector, three presentations — chosen by composition, not configuration.

## Installation

{% tabs %}
{% tab title="npm" %}
```sh
npm install @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { SideDrawer } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="pnpm" %}
```sh
pnpm add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { SideDrawer } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { SideDrawer } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="bun" %}
```sh
bun add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { SideDrawer } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
```sh
npx shadcn@latest add https://blamy.github.io/ui/r/side-drawer.json
```

Adds `@/components/ui/side-drawer.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import { SideDrawer } from '@/components/ui/side-drawer'
```
{% endtab %}
{% endtabs %}

| Mode | Presentation | Used when |
| --- | --- | --- |
| `fixed` | docked column beside the detail view | ≥1280px, room to spare |
| `overlay` | sheet from the right edge + scrim | desktop / tablet |
| pushed page | compose the same content as a screen | phones |

```jsx
// extra-wide: docked
<SideDrawer mode="fixed" open={act} title="Activity" width={318}>
  <ActivityView c={contact}/>
</SideDrawer>

// desktop/tablet: overlay sheet
<SideDrawer mode="overlay" open={act} onClose={close} title="Activity" width={340}>
  <ActivityView c={contact}/>
</SideDrawer>

// phone: the same content, pushed
screens.push({ key: 'activity', title: 'Activity', content: <ActivityView/> })
```

The content component doesn't know which presentation it's in — the Contacts demo picks per width class. The Workbench's [WorkbenchPanel](#workbench-shell) follows the same philosophy on desktop scales.

## Live example

{% demo src="side-drawer/activity-drawer" %}

## Examples

### Docked inspector

`mode="fixed"` is a column in the layout that animates its width. The toolbar button toggles it and the inspector follows the selected file.

{% demo src="side-drawer/file-inspector" %}

### Comments over the page

`mode="overlay"` slides over the content with a scrim; tapping the scrim or the close button calls `onClose`.

{% demo src="side-drawer/comments" %}

### One content, three presentations

The host measures itself with `useContainerWidth` and picks docked, overlay, or a pushed `NavigationStack` screen. `Activity` never knows which one it is in. Switch widths in the header.

{% demo src="side-drawer/adaptive-activity" %}

# @touchkit/ui

Touch-first React components inspired by UIKit container patterns. The package includes theme tokens, haptics, lists, navigation, adaptive split views, drawers, sheets, and a reusable jump rail.

## Install

```sh
pnpm add @touchkit/ui react react-dom
```

Import the stylesheet once, then wrap the part of the app that uses TouchKit tokens:

```tsx
import '@touchkit/ui/styles.css';
import { TouchKitProvider, NavigationStack } from '@touchkit/ui';

export function App() {
  return (
    <TouchKitProvider tint="#0a84ff">
      <NavigationStack screens={screens} onPop={handlePop} />
    </TouchKitProvider>
  );
}
```

React 18 and 19 are supported peer dependencies.

## IndexBar

`IndexBar` accepts application-defined string or numeric keys. Labels are optional, so dense timelines can render as dots, and `preview` accepts any React node. Hover previews without navigating; pointer drag and keyboard navigation (`ArrowUp`, `ArrowDown`, `Home`, `End`) commit a stop.

```tsx
import { IndexBar, type IndexBarItem } from '@touchkit/ui';

const stops: IndexBarItem<number>[] = turns.map((turn, index) => ({
  key: turn.sequence,
  label: index % 5 === 0 ? String(index + 1) : undefined,
  caption: turn.author,
  preview: <span>{turn.summary}</span>,
}));

<IndexBar
  items={stops}
  label="Jump to conversation turn"
  onJump={(sequence) => scrollToTurn(sequence)}
/>;
```

If `items` is omitted or empty, the component retains its A-Z form:

```tsx
<IndexBar
  avail={new Set(['A', 'B', 'K'])}
  onLetter={(letter) => scrollToSection(letter)}
/>;
```

## Core exports

- Containers: `NavigationStack`, `SplitView`, `Credenza`, `SideDrawer`
- Lists and navigation: `List`, `List.Section`, `List.Row`, `IndexBar`, `TabBar`, `EditBar`
- Inputs and feedback: `SearchField`, `Switch`, `Segmented`, `Haptics`, `HapticIndicator`
- Foundations: `TouchKitProvider`, `Icon`, `Avatar`, `Spinner`, token helpers

Every component exports its props type from the package root. See the Storybook catalog for interaction and responsive examples.

## Workspace development

```sh
pnpm nx build @touchkit/ui
pnpm nx lint @touchkit/ui
```

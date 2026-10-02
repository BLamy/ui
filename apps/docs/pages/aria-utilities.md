# Utilities

The other `react-aria` exports a project built on BL UI is likely to use: `mergeProps`, `useObjectRef` and friends for composing props and refs, `VisuallyHidden`, the locale providers and formatters, `useIsSSR`, and `UNSAFE_PortalProvider`. The interaction hooks have their own pages, listed in the [react-aria hooks overview](https://blamy.github.io/ui/#/aria-hooks). The library's own helpers (`cn`, `pressable`, `useContainerWidth`, …) are on [Utilities](https://blamy.github.io/ui/#/utilities) and [Hooks](https://blamy.github.io/ui/#/hooks).

Nothing to install: these come from `react-aria`, which BL UI already depends on.

```tsx
import { mergeProps, useObjectRef, VisuallyHidden, I18nProvider, useLocale, useNumberFormatter, useDateFormatter, useCollator, useFilter, useIsSSR } from 'react-aria'
```

What was chosen, and why: the first group is what BL UI's own source imports (`mergeProps` in `split-view.tsx` and `composer.tsx`, `VisuallyHidden` in `composer.tsx`, `UNSAFE_PortalProvider` in `lib/theme.tsx` and `command-menu.tsx`). The locale group is not used by the library itself, but it is the one set of utilities whose behavior changes how an app built on react-aria-components reads: they share one locale. Anything else react-aria exports is for the component hooks (`useButton`, `useListBox`, …), which are what react-aria-components already wraps.

## Props and refs

### `mergeProps`

```ts
function mergeProps<T extends PropsArg[]>(...args: T): UnionToIntersection<TupleTypes<T>>
```

Merges props objects: **event handlers are chained** (all run, in order), `className`s are combined, ids are deduplicated, refs are merged, and for every other prop the last object wins. It is how several hooks share one element:

```tsx
<div {...mergeProps(moveProps, focusProps, hoverProps, { onKeyDown, onDoubleClick })} />
```

This is the SplitView resizer in `split-view.tsx`. Spreading two props objects normally replaces `onKeyDown`; `mergeProps` runs both. The examples on these pages merge a press, hover, focus-visible, keyboard or clipboard hook with the element's own handlers, for example the paste inspector's own `onPaste` next to the hook's `clipboardProps`, and both ran (verified: the element's handler ran first and set aside the pasted files the hook's handler then used).

### `chain` and `mergeRefs`

```ts
function chain(...callbacks: any[]): (...args: any[]) => void
function mergeRefs<T>(...refs: Array<Ref<T> | MutableRefObject<T> | null | undefined>): Ref<T>
```

`chain` calls functions in order with the same arguments. `mergeRefs` gives one ref that updates a callback ref or an object ref, whichever you pass.

### `useObjectRef`

```ts
function useObjectRef<T>(ref?: ((instance: T | null) => (() => void) | void) | MutableRefObject<T | null> | null): MutableRefObject<T | null>
```

Turns a callback ref or object ref you were given into an **object** ref, which is what react-aria hooks need (`useLandmark(props, ref)`, `useDrop({ ref })`). Use it where a component accepts a forwarded ref and also needs the element for a hook:

```tsx
function Card({ ref, ...props }: { ref?: Ref<HTMLDivElement> } & HTMLAttributes<HTMLDivElement>) {
  const objectRef = useObjectRef(ref)
  const { landmarkProps } = useLandmark({ role: 'region', 'aria-label': 'Card' }, objectRef)
  return <div ref={objectRef} {...landmarkProps} {...props} />
}
```

React 19 passes `ref` as a prop, as BL UI's components do; the same function wraps a `forwardRef` ref in older code.

### `useId`

```ts
function useId(defaultId?: string): string
```

react-aria's id hook: the given id if you pass one, else a generated one. (`mergeProps` deduplicates ids when two props objects carry one.) For an id of your own in a client component, React's `useId` is what BL UI itself uses (`list.tsx`, `credenza.tsx`, `floating-sheet.tsx`); reach for this one when an id has to be shared with a react-aria hook that can replace it.

### `VisuallyHidden`

```ts
function VisuallyHidden(props: VisuallyHiddenProps): JSX.Element
function useVisuallyHidden(props?: VisuallyHiddenProps): VisuallyHiddenAria

interface VisuallyHiddenProps extends DOMAttributes {
  children?: ReactNode
  elementType?: string | JSXElementConstructor<any>   // default 'div'
  isFocusable?: boolean   // become visible on focus: a skip link
}
```

Content that screen readers read and sighted users do not see. BL UI uses it in the Composer twice: for the live region that announces what a drop, paste or pick attached, and around the hidden button that is the drop target's keyboard route. `isFocusable` makes a skip link: hidden until it takes focus.

```tsx
<VisuallyHidden>{attached} files attached</VisuallyHidden>
```

## Locale

### `I18nProvider`, `useLocale`

```ts
function I18nProvider(props: { children: ReactNode; locale?: string }): JSX.Element
function useLocale(): { locale: string; direction: 'ltr' | 'rtl' }
```

`I18nProvider` sets the locale (a BCP 47 tag) for everything under it; without one, react-aria reads the browser's. `useLocale` returns it with the writing direction. Every react-aria-components element, and each of the formatters below, reads it from context, so one provider localizes dates, numbers, sorting and filtering together.

### The formatters

| Hook | Returns | Use |
| --- | --- | --- |
| `useNumberFormatter(options?)` | `Intl.NumberFormat` | `format(1234.5)` with currency, percent, units |
| `useDateFormatter(options?)` | a `DateFormatter` | `format(date)`, with the options of `Intl.DateTimeFormat` plus `calendar` |
| `useCollator(options?)` | `Intl.Collator` | `[...names].sort(collator.compare)` |
| `useFilter(options?)` | `{ startsWith, endsWith, contains }` | locale-aware string matching; the options are the collator's (`sensitivity`) |

All of them cache their formatter and update when the locale changes, so calling them in render is fine.

{% demo src="aria-utilities/locale" %}

Verified in Chromium:

- **Formatters follow the provider.** `1234.5` as euros reads `€1,234.50` in `en-US` and `1.234,50 €` in `de-DE`; the date reads `9. März 2026` in `de-DE`.
- **`ar-EG` is right to left**: `useLocale()` reports `direction: 'rtl'`, and the example sets `dir` from it.
- **`sensitivity: 'base'` treats `e`, `é` and `ë` as one letter**, both for `useFilter` (typing `e` finds Élodie, Émile and Zoë) and for `useCollator` (Élodie sorts with the E's, and Zoë and Zoe compare equal). The default sensitivity would not match them.
- The example passes `timeZone: 'UTC'` and a UTC date, so the text does not depend on where the test runs.

## Environment

### `useIsSSR`, `SSRProvider`

```ts
function useIsSSR(): boolean
function SSRProvider(props: { children: ReactNode }): JSX.Element
```

`useIsSSR()` is true during a server render **and during hydration**, then false: use it to delay something browser-only until after hydration, without a mismatch. `SSRProvider` is only needed with React 16 or 17; on React 18 and later it renders its children and, from its source, warns once in development that it is a no-op. BL UI's React 19 apps do not need it.

### `UNSAFE_PortalProvider`

```ts
function UNSAFE_PortalProvider(props: { getContainer?: (() => HTMLElement | null) | null; children: ReactNode }): JSX.Element
```

Sets the element that react-aria overlays (popovers, modals, tooltips) render into instead of `document.body`. `BLProvider` uses it (`lib/theme.tsx`) so an overlay lands inside the provider's themed root, and `CommandMenu` uses it when you give it a `container` to render into. The "UNSAFE" prefix is react-aria's name for an API that may change; BL UI wraps it so an app does not call it directly. If you render outside a `BLProvider`, an overlay goes to `document.body`.

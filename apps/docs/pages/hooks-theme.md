# Theme hooks

Hooks that read the ambient light or dark appearance, the theme scope an overlay should wear, the shared "chrome hidden" flag that nav bars and tab bars follow, and the Workbench's appearance. The theme system itself (tokens, `BLProvider`, `ThemeScope`) is on the [Theming](https://blamy.github.io/ui/#/theming) page; the other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

All five are public.

```tsx
// npm
import { useAppearance, useThemeScopeProps, useChromeHidden, useScrollHidden, useWorkbenchAppearance } from '@brett_lamy/ui'

// shadcn registry (aliases)
import { useAppearance, useThemeScopeProps, useChromeHidden } from '@/lib/theme'            // …/r/theme.json
import { useScrollHidden } from '@/lib/scroll-hidden'                                        // …/r/scroll-hidden.json
import { useWorkbenchAppearance } from '@/components/ui/workbench-theme'                    // …/r/workbench-theme.json
```

## `useAppearance`

The ambient light or dark choice: the value of the nearest `AppearanceProvider`, else `'dark'` when the page has the shadcn `dark` class on `<html>`, else `undefined` ("no preference").

- **Export:** public. Registry item `theme` (`@/lib/theme`).
- **Needs:** nothing. **Without a provider:** `'dark'` or `undefined`.

```ts
function useAppearance(): 'light' | 'dark' | undefined
```

```tsx
import { AppearanceProvider, useAppearance } from '@brett_lamy/ui'

// once, near the root: your app's own setting
<AppearanceProvider value={settings.dark ? 'dark' : 'light'}>
  <App />
</AppearanceProvider>

function CodeTheme() {
  const appearance = useAppearance() ?? 'light'
  return <Diff theme={appearance === 'dark' ? 'github-dark' : 'github-light'} />
}
```

`BLProvider`, `ThemeScope`, the chat shell and the Workbench all read it, so setting it once themes the surfaces below it. An explicit `appearance` or `dark` prop on one of them wins.

{% demo src="hooks-theme/appearance" %}

Gotchas:

- **A `ThemeScope` does not publish its appearance to this hook.** The scope sets a class and a `ThemeScopeContext`, but `useAppearance()` inside `<ThemeScope appearance="dark">` still returns the provider's value (or the `<html>` class). Only `AppearanceProvider` changes what `useAppearance` returns, as the demo shows. For a library that needs the scope's appearance, such as a diff or editor theme, wrap the subtree in an `AppearanceProvider` too, or use `useThemeScopeProps` below.
- **It never returns `'light'` by itself.** Without a provider, light is `undefined`: there is no detection of an `html.light` class or of `prefers-color-scheme`. Treat `undefined` as "the host's default", usually light.
- **Server render.** The server snapshot is "no `dark` class", so the server render and the hydration render return `undefined` (or the provider's value) and a page that uses the `dark` class updates right after hydration. It observes only changes to the `class` attribute of `<html>`.

## `useThemeScopeProps`

The props a portalled overlay needs to wear the theme scope of the surface that opened it. Popovers, menus, dialogs and tooltips render in a portal, outside the scope's DOM, so CSS inheritance cannot reach them; `ThemeScope` publishes its scope and the overlay primitives spread this onto their root.

- **Export:** public. Registry item `theme`.
- **Needs:** to be rendered inside a `ThemeScope`. **Outside one:** returns `{}`; nothing is applied.

```ts
function useThemeScopeProps(): { 'data-theme-scope'?: string; className?: string; style?: CSSProperties }
```

The result carries the nearest scope's `data-theme-scope`, its appearance class (`dark scheme-dark` or `light scheme-light`), and a `style` with its `tint` and `vars` as CSS variables. Scopes nest and the nearest wins.

```tsx
import { createPortal } from 'react-dom'
import { cn, useThemeScopeProps } from '@brett_lamy/ui'

function Callout({ children }: { children: React.ReactNode }) {
  const scope = useThemeScopeProps()
  return createPortal(
    <div
      data-theme-scope={scope['data-theme-scope']}
      className={cn('fixed right-4 bottom-4 rounded-card bg-card p-3 text-foreground', scope.className)}
      style={scope.style}
    >
      {children}
    </div>,
    document.body,
  )
}
```

Gotchas:

- **Only `ThemeScope` publishes the context.** `BLProvider` does not, but it portals react-aria overlays into its own root, which already carries its appearance class, so they inherit it. Use this hook for overlays you portal yourself.
- The hook returns a new `style` object each call. `readThemeVars(el)` and `themeScopeProps(...)`, also public, are the non-hook versions for code that has an element or the scope options in hand.

## `useChromeHidden`

Whether the shared "chrome" (the navigation bar and the tab bar) is hidden. A scrolling screen hides both when you scroll down and brings them back when you scroll up, and everything that follows reads this one flag, wherever it is in the tree.

- **Export:** public, together with `chromeStore` and `chromeOffset`. Registry item `theme`.
- **Needs:** nothing: it is a module-level store, not a context, so there is no provider to wrap. **Default:** `false`.

```ts
function useChromeHidden(): boolean
```

```tsx
function FloatingAction() {
  const hidden = useChromeHidden()
  return <button className={hidden ? 'translate-y-full' : ''}>New</button>
}
```

`NavigationStack` publishes it while a screen scrolls: it hides after a downward scroll of more than 5px once the scroll position is past about 70% of the bar height, shows again on an upward scroll of more than 5px or near the top, and resets to visible whenever a screen unmounts (a pop included). A screen can opt out with `hideChromeOnScroll: false`. `TabBar` and `TabView` (`hideOnScroll`), `List`'s sticky headers, and the hide-on-scroll of `FloatingSheet` and `FloatingChat` read it. To drive it from a scroller of your own, set the store: `chromeStore.set(true)` hides, `chromeStore.set(false)` shows.

Gotchas:

- **It is global.** Two navigation stacks on one page share one flag, and any scroller that sets it hides every tab bar.
- A fresh subscriber starts from the store's current value and syncs again in an effect, so a component mounted while the chrome is hidden is correct after the first commit.
- Nothing is published on the server; it is `false` there.
- `chromeOffset(top, hidden)` turns a bar height into the offset sticky headers stop at: while hidden it moves up by one bar height (`BARH`, 52px), never below zero.

## `useScrollHidden`

Whether floating chrome (a tab bar, a floating sheet, a floating chat) should hide: the shared chrome state says the bars are hidden, or a scroller of your own was scrolled down. It is what `FloatingSheet` and `FloatingChat` use for `hideOnScroll`.

- **Export:** public. Registry item `scroll-hidden` (`@/lib/scroll-hidden`), which depends on `theme`.
- **Needs:** nothing.

```ts
function useScrollHidden(hideOnScroll: boolean, scrollRef?: RefObject<HTMLElement | null>): boolean
```

```tsx
function Fab({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const hidden = useScrollHidden(true, scrollRef)
  return <button className={hidden ? 'translate-y-full' : ''}>New</button>
}
```

It is `false` whenever `hideOnScroll` is `false`. Otherwise it is `true` while `useChromeHidden()` is, or while `scrollRef`'s element has been scrolled down: more than 3px of downward scroll hides, more than 3px up shows, and within 4px of the top it always shows. The scroll listener is passive.

Gotchas:

- **The scroller is read once, in an effect.** It re-runs only when `scrollRef` (the ref object) or `hideOnScroll` changes, so `scrollRef.current` must already be set when the component commits. A scroller that mounts later is never listened to, and only the shared chrome state applies.
- Without a `scrollRef`, it reduces to `hideOnScroll && useChromeHidden()`.

## `useWorkbenchAppearance`

The resolved appearance of the nearest Workbench root, for pieces whose third-party renderers need it as a prop (a diff theme, an editor theme).

- **Export:** public, with `WorkbenchTheme` and `WorkbenchAppearanceProvider`. Registry item `workbench-theme`.
- **Needs:** nothing, but it is meant for use below a `WorkbenchTheme` (or the WorkbenchShell block, which provides it). **Outside one:** it still works and returns the ambient appearance, else `'dark'`.

```ts
function useWorkbenchAppearance(explicit?: 'light' | 'dark'): 'light' | 'dark'
```

The result is the first of: the `explicit` argument, the enclosing Workbench root's appearance, the ambient `AppearanceProvider` value (or `<html class="dark">`), then `'dark'`. Unlike `useAppearance`, it is never `undefined`, and it never falls back to light.

```tsx
function FileDiff({ patch }: { patch: string }) {
  const appearance = useWorkbenchAppearance()
  return <Diff patch={patch} theme={appearance === 'dark' ? 'github-dark' : 'github-light'} />
}
```

Details are on the [WorkbenchTheme](https://blamy.github.io/ui/#/workbench-theme) page.

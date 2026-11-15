# Theme hooks

Hooks that read the ambient light or dark appearance, the theme scope an overlay should wear, the nearest scope and the appearance it resolves to, and the shared "chrome hidden" flag that nav bars and tab bars follow. The theme system itself (tokens, `BLProvider`, `ThemeScope`) is on the [Theming](https://blamy.github.io/ui/#/theming) page; the other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

All five are public. 6.0 removed `useScrollHidden`: floating chrome of your own uses `useHideOnScroll` from `@/lib/scroll-edge` (see [Layout hooks](https://blamy.github.io/ui/#/hooks-layout)), and anything else reads `useChromeHidden()`.

```tsx
// npm
import { useAppearance, useThemeScope, useScopeAppearance, useThemeScopeProps, useChromeHidden } from '@brett_lamy/ui/lib/theme'

// shadcn registry (aliases)
import { useAppearance, useThemeScope, useScopeAppearance, useThemeScopeProps, useChromeHidden } from '@/lib/theme' // …/r/theme.json
```

## `useAppearance`

The ambient light or dark choice: the value of the nearest `AppearanceProvider`, else `'dark'` when the page has the shadcn `dark` class on `<html>`, else `undefined` ("no preference").

- **Export:** public. Registry item `theme` (`@/lib/theme`).
- **Needs:** nothing. **Without a provider:** `'dark'` or `undefined`.

```ts
function useAppearance(): 'light' | 'dark' | undefined
```

```tsx
import { AppearanceProvider, useAppearance } from '@brett_lamy/ui/lib/theme'

// once, near the root: your app's own setting
<AppearanceProvider value={settings.dark ? 'dark' : 'light'}>
  <App />
</AppearanceProvider>

function CodeTheme() {
  const appearance = useAppearance() ?? 'light'
  return <Diff theme={appearance === 'dark' ? 'github-dark' : 'github-light'} />
}
```

`BLProvider`, `ThemeScope`, the chat shell and the Workbench all read it, so setting it once themes the surfaces below it. An explicit `appearance` (`'light'` or `'dark'`) on one of them wins; `'auto'` follows the provider.

{% demo src="hooks-theme/appearance" %}

Gotchas:

- **A `ThemeScope` does not publish its appearance to this hook.** The scope sets a class and a context (`useThemeScope()` reads it), but `useAppearance()` inside `<ThemeScope appearance="dark">` still returns the provider's value (or the `<html>` class). Only `AppearanceProvider` changes what `useAppearance` returns, as the demo shows. For a library that needs the scope's appearance, such as a diff or editor theme, wrap the subtree in an `AppearanceProvider` too, or use `useThemeScopeProps` below.
- **It never returns `'light'` by itself.** Without a provider, light is `undefined`: there is no detection of an `html.light` class or of `prefers-color-scheme`. Treat `undefined` as "the host's default", usually light.
- **Server render.** The server snapshot is "no `dark` class", so the server render and the hydration render return `undefined` (or the provider's value) and a page that uses the `dark` class updates right after hydration. It observes only changes to the `class` attribute of `<html>`.

## `useThemeScopeProps`

The props a portalled overlay needs to wear the theme scope of the surface that opened it. Popovers, menus, dialogs and tooltips render in the layer host (BLProvider's root), outside the scope's DOM, so CSS inheritance cannot reach them; `ThemeScope` publishes its scope and the kit's popup parts spread this onto themselves.

- **Export:** public. Registry item `theme`.
- **Needs:** to be rendered inside a `ThemeScope`. **Outside one:** returns `{}`; nothing is applied.

```ts
function useThemeScopeProps(): { 'data-theme-scope'?: string; className?: string; style?: CSSProperties }
```

The result carries the nearest scope's `data-theme-scope`, its appearance class (`dark scheme-dark` or `light scheme-light`), and a `style` with its `tint` and `vars` as CSS variables. Scopes nest and the nearest wins.

```tsx
import { createPortal } from 'react-dom'
import { cn } from '@brett_lamy/ui/lib/utils'
import { useThemeScopeProps } from '@brett_lamy/ui/lib/theme'

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

- **Only `ThemeScope` publishes the context.** `BLProvider` does not, but it is the layer host for UI SDK popups (`useLayerHost()`): dialogs, menus, popovers and toasts render inside its root, which already carries its appearance class, so they inherit it. The kit's popup parts also spread this hook's `style` onto themselves, so a popup opened from inside a `ThemeScope` wears that scope. Use this hook for overlays you place yourself.
- The hook returns a new `style` object each call. `readThemeVars(el)` and `themeScopeProps(...)`, also public, are the non-hook versions for code that has an element or the scope options in hand.

## `useChromeHidden`

Whether the shared "chrome" (the navigation bar and the tab bar) is hidden. A scrolling screen hides both when you scroll down and brings them back when you scroll up, and everything that follows reads this one flag, wherever it is in the tree.

- **Export:** public, from the package root, with `setChromeHidden(hidden)`, which publishes the flag from a scroller of your own (as a NavigationStack page does). Registry item `theme`.
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

`NavigationStack` publishes it while its top page scrolls: the bar hides after a downward scroll of more than 5px once the scroll position is past about 70% of the bar height, and shows again on an upward scroll of more than 5px or near the top. A page opts out with `<NavigationStackBar hideOnScroll={false}>`, and the stack's `onBarHiddenChange(hidden)` reports the same change. the `Tabs` bar (`TabsBar hideOnScroll`), `List`'s sticky headers, and `useHideOnScroll` (behind `FloatingSheet` and `ArtifactChatContainer`) read it. To drive it from a scroller of your own, call `setChromeHidden(true)` to hide and `setChromeHidden(false)` to show.

Gotchas:

- **It is global.** Two navigation stacks on one page share one flag, and any scroller that sets it hides every tab bar.
- A fresh subscriber starts from the store's current value and syncs again in an effect, so a component mounted while the chrome is hidden is correct after the first commit.
- Nothing is published on the server; it is `false` there.
- Sticky list headers follow it too: while the chrome is hidden the offset they stop at moves up by one bar height (52px), never below zero.

## `useThemeScope` and `useScopeAppearance`

The nearest `ThemeScope`'s resolved state, and the appearance a scope of a given name resolves to here, for pieces whose third-party renderers need the appearance as a prop (a diff theme, an editor theme).

- **Export:** public. Registry item `theme` (`@/lib/theme`).
- **Needs:** nothing. **Outside a scope:** `useThemeScope()` is `null`; `useScopeAppearance` still answers from the ambient appearance and the scope's default.

```ts
function useThemeScope(): { scope?: string; appearance?: 'light' | 'dark'; tint?: string; vars?: ThemeVars } | null
function useScopeAppearance(scope?: ThemeScopeName, appearance?: 'auto' | 'light' | 'dark'): 'light' | 'dark' | undefined
```

`useScopeAppearance` is the rule `ThemeScope` itself applies: the terminal scope is always dark; otherwise the explicit `appearance` (`'auto'` counts as none), else an enclosing scope of the same name, else the ambient `AppearanceProvider` value (or `<html class="dark">`), else the scope's default (`'dark'` for `workbench`, `'light'` for the other named scopes, `undefined` for a plain scope). A `BLProvider` resets the scope for what it contains, as it does for overlays.

```tsx
function FileDiff({ patch }: { patch: string }) {
  const appearance = useScopeAppearance('workbench')
  return <Diff patch={patch} theme={appearance === 'dark' ? 'github-dark' : 'github-light'} />
}
```

The workbench scope is described on the [Theming](https://blamy.github.io/ui/#/theming) page.

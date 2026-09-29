# Migrating to 2.0

BL UI 2.0 moves every color onto shadcn's CSS variables. The three parallel palettes (`--bl-*`, `--wb-*`, `--ck-*`) are gone: parts use `bg-background`, `text-muted-foreground`, `border-border` and friends, the iOS look ships as a theme (the **bl-theme**), and the Workbench and chat looks are theme scopes. A few duplicate parts were merged and the Discord- and T3-specific parts moved into their blocks.

## 1. Install the theme

1.x set its palette from `BLProvider`. In 2.0 the palette is your CSS. To keep the 1.x look, add the bl-theme:

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json{% endcommand %}

or, without the shadcn CLI:

```css
@import "@brett_lamy/ui/styles.css";
@import "@brett_lamy/ui/theme.css";
```

Without it, BL UI's parts wear your app's shadcn theme.

## 2. Token map

Replace the old utilities and variables with the shadcn ones. Inside a `WorkbenchShell` / `WorkbenchTheme` (workbench scope) or a `ChatShell` (chat scope) the same names resolve to that surface's values, so one map covers all three palettes.

| 1.x (`--bl-*`) | 1.x (`--wb-*`) | 1.x (`--ck-*`) | 2.0 variable | 2.0 utility |
| --- | --- | --- | --- | --- |
| `bg` | `bg` | `bg` | `--background` | `bg-background` |
| `bg2` | `well` | `rail` | `--muted` | `bg-muted` |
| `card` | `card` | `card` | `--card` | `bg-card` |
| `card2` | `card2` | — | `--popover` | `bg-popover` |
| `label` | `label` | `label` | `--foreground` | `text-foreground` |
| `label2` | `label2` | `mut` | `--muted-foreground` | `text-muted-foreground` |
| `label3` | `label3` | `mut3` | `--tertiary-foreground` | `text-tertiary-foreground` |
| `sep` | `sep` | `sep` | `--border` | `border-border` |
| `fill` | `fill` | `fill` | `--secondary` | `bg-secondary` |
| `fill2` | `fill2` | `fill2` | `--secondary-strong` | `bg-secondary-strong` |
| `press` | (hover: `fill`) | `hover` | `--accent` | `bg-accent` |
| `bar` | — | — | `--bar` | `bg-bar` |
| `stick` | — | — | `--sticky` | `bg-sticky` |
| `side` | `side` | `side` | `--sidebar` | `bg-sidebar` |
| `scrim` | — | `scrim` | `--overlay` | `bg-overlay` |
| `tint` | `tint` | `tint` | `--primary` | `bg-primary`, `text-primary` |
| `on-tint` | — | — | `--primary-foreground` | `text-primary-foreground` |
| — | — | `on-fill` | `--secondary-foreground` | `text-secondary-foreground` |
| `red` | `red` | `red` | `--destructive` | `text-destructive` |
| `green` | `green` | `green` | `--success` | `text-success` |
| `orange` | — | `orange` | `--warning` | `text-warning` |
| — | `handle` | — | `--handle` | `bg-handle` |
| — | `term` | — | `terminal` scope's `--background` | `bg-background` in a terminal scope |
| — | — | `link` | `--link` | `text-link` |
| — | — | `mention` / `mine` | `--primary` washes | `bg-primary/12 dark:bg-primary/16` |
| `--mdc-pre` / `--mdc-pre-fg` | | | `--code` / `--code-foreground` | `bg-code`, `text-code-foreground` |

A custom palette that overrode `--bl-*` tokens through `style` now overrides the shadcn names: `'--bl-card'` → `'--card'`, `'--bl-label2'` → `'--muted-foreground'`.

## 3. Providers and helpers

| 1.x | 2.0 |
| --- | --- |
| `BLProvider` set `--bl-*` inline | `BLProvider` puts `light` / `dark` on its root; `tint` sets `--primary` / `--ring` (default: the theme's primary) |
| `WorkbenchTheme` set `--wb-*` inline | `WorkbenchTheme` = a `workbench` theme scope (`ThemeScope scope="workbench"`) with base styling |
| `ChatShell` set `--ck-*` inline | `ChatShell` opens a `chat` theme scope; `tint` sets `--primary` |
| `blLightVars`, `blDarkVars`, `workbenchVars`, `workbenchAppearanceClass`, `chatVars`, `chatTokens`, `chatLightTokens`, `chatTokenVars`, `chatLightTokenVars`, `K`, `sidebarDarkVars` | removed — use the bl-theme, `ThemeScope`, `themeScopeProps()` |
| `readWbTokens` | `readThemeVars` |
| `KFONT`, `KMONO`, `KEASE`, `WFONT`, `MONO`, `PFONT`, `PMONO` | `font-ios` / `font-mono` utilities, `ease-ios` |

## 4. Removed and renamed components

| 1.x | 2.0 |
| --- | --- |
| `PillButton` | `<Button size="pill">` (`tone="soft"` → `variant="secondary"`) |
| `WIcon`, `ChatIcon` + `chatIconPaths`, `PKIcon` | `Icon` — their shapes are in the Icon set |
| `useSpringSheetDrag` | `useSheetDrag` (the old `useSheetDrag` is removed) |
| `MorphText` | `TextMorph` |
| `WorkspaceRail` (+ `…List`, `…Item`, `…Home`, `…Separator`, `…Action`) | a vertical `TabView` with `TabViewBar variant="workspace"`, `TabViewIndicator variant="pill"`, `TabViewSeparator` and a `TabViewFooter` › `TabViewAction`; the Discord tile is the discord-clone block's `WorkspaceTile` |
| `kvib` | `Haptics` (`Haptics.impact('light')`, `Haptics.selection()`) |

## 5. Parts that moved into blocks

Parts that only one app used now live in that app's block, where you can edit them freely:

| Part | Block |
| --- | --- |
| `ServerHeader`, `ChannelList`, `ChannelGroup`, `ChannelItem`, `ChannelThreadItem`, `UserPanel*` (+ `presenceLabel`, `ChatPresence`), `MemberList` / `MemberGroup` / `MemberItem`, `ThreadPreview`, `ThreadPreviewReply`, `ThreadHeader`, `Message*` (+ `messageVariants`), `MessageList`, `MessageGroup`, `MessageDivider`, `DateDivider`, `MessageListEmpty`, `ChannelIntro`, `TypingIndicator`, `ChatComposer*`, `ChatAvatar`, `RichText`, `ChatUsersProvider` / `useChatUsers` / `ChatUser` | `discord-clone` (`components/*`) |
| `ThreadSidebar`, `ThreadSidebarHeader`, `ThreadSidebarBrand`, `ThreadSidebarToolbar`, `ThreadSearch`, `ThreadNewButton`, `ProjectSwitcher`, `ThreadList`, `ThreadGroup`, `ThreadItem`, `ThreadShowMore`, `ThreadSidebarFooter`, `SidebarNotice`, `SidebarFooterItem`, `SidebarUser` | `t3-clone` (`components/thread-sidebar.tsx`) |

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/discord-clone.json{% endcommand %}

# BL Notes

A one-off Electron app for <https://blamy.github.io/ui/?demo=blocks/apple-notes>.
It opens the hosted demo in a frameless macOS window with native traffic lights.
Drag the column toolbar backgrounds to move the window; toolbar controls, search,
column dividers, and the editor keep their normal mouse behavior. It uses a separate persistent
profile at `~/Library/Application Support/BL Notes`. Browser notes, remembered
folder handles, window size, and window position survive relaunches. The page
requires an internet connection when opening; this wrapper does not add offline
support or cloud sync. Notes from an existing web browser are not imported.

The renderer is sandboxed with Node integration disabled. Only the notes page
stays in the app; external HTTP(S) links open in the default browser. Files and
folders are selected through the page's native file picker. A native **Allow Access**
dialog grants read/write access to that selection, and the app remembers the grant
in `folder-permissions.json` in its profile. Protected system folders offer a
**Choose Another Folder** dialog. Closing the window
keeps the app in the Dock; clicking its icon reopens it. Use Command-Q to quit.
Command-N opens the demo's New Note dialog; Command-S uses its existing save action.

From the workspace root:

```sh
pnpm nx run bl-notes-desktop:bootstrap
pnpm nx run bl-notes-desktop:check
pnpm nx run bl-notes-desktop:test
pnpm nx run bl-notes-desktop:package
pnpm nx run bl-notes-desktop:start
```

The Electron build dependencies and lockfile are isolated in this directory.
The generated bundle is `dist/tools/notes-desktop/BL Notes-darwin-arm64/BL Notes.app`
on Apple Silicon. It is locally ad-hoc signed for personal use, without Apple
notarization. Copy the finished bundle to `/Applications/BL Notes.app`, launch it,
and choose **Options → Keep in Dock** from its Dock menu.

## Icon

`assets/icon.png` is an original icon generated with the built-in imagegen tool.
The build creates a complete macOS `.icns` at all standard resolutions.

Generation prompt: A polished macOS Dock icon: a warm golden-yellow rounded square
with an ivory folded-corner note sheet, a narrow notebook spine, three graphite
lines, and a small golden checkmark; subtle native materials and soft shadows,
straight-on view, transparent surroundings, no text or Apple logo.

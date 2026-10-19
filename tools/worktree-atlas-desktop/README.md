# Worktree Atlas

A macOS app for <https://blamy.github.io/ui/?demo=blocks/worktree-atlas>: every Git
worktree on this Mac, grouped by project. It opens the hosted block in a frameless
window with native traffic lights. Drag a column toolbar (or the top of the sidebar's
Files / Changes rail, or the welcome screen's backdrop) to move the window. It uses its
own persistent profile at `~/Library/Application Support/Worktree Atlas`, so opened
folders, window size and position survive relaunches. The page needs an internet
connection to open; Git itself runs in the page (isomorphic-git) and nothing is uploaded.

The renderer is sandboxed with Node integration disabled. Only the block stays in the
app; other links open in the default browser. Folders are chosen with the page's own
folder picker (**Open Folder…**, or File → Open Folder… / Command-O). A native dialog
asks before Atlas may **read** a folder, and asks again, separately, the first time it
needs to **delete** worktrees in it; both answers are remembered in
`folder-permissions.json` in the profile. Protected locations (your whole home folder)
offer **Choose Another Folder**: pick the folder your projects live in, like `~/Code`,
and any folder agents keep worktrees in, like `~/.codex`. Command-R scans again.
Closing the window keeps the app in the Dock; Command-Q quits.

From the workspace root:

```sh
pnpm nx run worktree-atlas-desktop:bootstrap
pnpm nx run worktree-atlas-desktop:check
pnpm nx run worktree-atlas-desktop:test
pnpm nx run worktree-atlas-desktop:package
pnpm nx run worktree-atlas-desktop:start
```

The Electron build dependencies and lockfile are isolated in this directory. The bundle
is `dist/tools/worktree-atlas-desktop/Worktree Atlas-darwin-arm64/Worktree Atlas.app` on
Apple Silicon, ad-hoc signed for personal use (not notarized). Copy it to
`/Applications/Worktree Atlas.app`, launch it, and choose **Options → Keep in Dock**.

## Icon

`assets/icon.svg` is the source: an indigo tile in the block's tint, with a trunk and
two worktree branches (mint and amber heads) drawn over faint atlas meridians.
`pnpm nx run worktree-atlas-desktop:icon` renders it to the 1024px `assets/icon.png`
with the workspace's Playwright Chromium; the build turns that into a full `.icns`.

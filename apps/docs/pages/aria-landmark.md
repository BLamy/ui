# Landmarks

`useLandmark` registers a region of the page so keyboard users can jump between regions with **F6** and **Shift+F6**, the way desktop apps let you move between panes. It adds the landmark role and label for screen readers at the same time. It is the last of the interaction hooks in the [react-aria hooks overview](https://blamy.github.io/ui/#/aria-hooks).

Nothing to install: it comes from `react-aria`, which BL UI already depends on.

```tsx
import { useLandmark, type AriaLandmarkRole } from 'react-aria'
```

## Signature

```ts
function useLandmark(props: AriaLandmarkProps, ref: RefObject<FocusableElement | null>): LandmarkAria

interface AriaLandmarkProps extends AriaLabelingProps {
  role: 'main' | 'region' | 'search' | 'navigation' | 'form' | 'banner' | 'contentinfo' | 'complementary'
  focus?: (direction: 'forward' | 'backward') => void
}
interface LandmarkAria {
  landmarkProps: DOMAttributes   // role, aria-label / aria-labelledby, and a temporary tabIndex
}
```

| Option | Effect |
| --- | --- |
| `role` | One of the eight landmark roles above. |
| `aria-label`, `aria-labelledby` | The landmark's name. Required when two landmarks on the page share a role. |
| `focus(direction)` | What to do when F6 arrives with nothing to restore. Replace it to focus something specific inside; the default focuses the landmark element itself. If you give one, focusing is your job. |
| `ref` | The landmark element. |

## What it does

{% demo src="aria-landmark/regions" %}

Verified in Chromium:

- **F6** moves focus to the next landmark in **document order** and **Shift+F6** to the previous one. From the last landmark F6 wraps to the first; from outside every landmark (after clicking empty space) the first F6 lands on the first landmark.
- **Alt+F6** goes to the `main` landmark.
- **Returning restores.** If you were in the "Messages" region on the Archive button, pressed F6 and then Shift+F6, focus comes back to Archive, not to the region's container. A region with no remembered element gets focus on the container itself.
- The hook sets the role and the accessible name on your element, so it shows in the accessibility tree as `navigation "Primary"`, `main "Messages"` and so on. Pass `role` and a label; the element can be a plain `div`.

From the source:

- The container gets `tabIndex={-1}` only while it is being focused by F6, so a landmark is not a tab stop. It needs a visible focus style of its own for that moment: the example uses `useFocusRing` on the same element.
- **One manager per document.** Landmarks register with a manager stored on `document` under a `Symbol.for('react-aria-landmark-manager')` key, so every copy of react-aria on a page (a library's and the app's) joins the same one. The F6 listener is added with the first landmark and removed with the last.
- **Hidden landmarks are skipped:** one inside an `aria-hidden="true"` ancestor is passed over.
- **Dev warnings:** more than one landmark with the same role needs labels, and labels must be unique; more than one `main` logs an error. Both are `console` output in development only.
- **Beyond the page:** at either end of the sequence it dispatches a cancelable `react-aria-landmark-navigation` event (with `detail.direction`), so an app that hosts iframes can carry F6 across them.
- **`UNSTABLE_createLandmarkController`**, for moving between landmarks from code, is **not** exported by `react-aria` 3.52.1: only its `LandmarkController` type is. The hook is the stable part.

## When to use it

Use it for the regions of an app shell: header, sidebar navigation, the main content, a details pane, a composer. A page that is one scrolling column has nothing to jump between. Semantic HTML (`<nav>`, `<main>`, `<aside>`) gives screen readers the landmark, but nothing for a sighted keyboard user; the hook adds that. Label every landmark, and keep roles distinct where you can.

## In BL UI

- **Toast.** The `Toaster` region comes from react-aria's `useToastRegion` (`toast.tsx`), which registers itself with `useLandmark` inside react-aria. Verified: with a toast showing, the DOM has one `role="region"` whose label is react-aria's generated "1 notification." (react-aria's own string, which counts the toasts), and F6 from the page moves focus to it. The Toast page calls it the "Notifications" landmark; the label it carries in this build is the count.
- **Your own shells.** `ChatShell`, `WorkbenchShell`, `SplitView` and the other containers do not register landmarks themselves; a shell you build from them can wrap each pane's content in a `useLandmark` element, as the example does, and the Toast region will join the same F6 cycle. (`SplitViewSidebar` is already a `section` labelled "Sidebar".)

## Context menus

`useContextMenu`, the other hook in this group, is documented with the press hooks: [Press, hover, move and keyboard](https://blamy.github.io/ui/#/aria-press).

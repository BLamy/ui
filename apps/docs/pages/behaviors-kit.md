# The kit's behaviors

BL UI's containers are iOS-style: they adapt to their **own** box (a phone frame, a window, one column of a split view), never the viewport, and they push and pop pages with a swipe from the edge and the platform's back. UI SDK has no behavior for any of that, so the kit has its own: size classes, page stacks, edge swipes, the platform back, pull to refresh, and React presence. Each is a small, framework-free module in `packages/ui/src/lib` (presence is the React side of UI SDK's `animateIn` / `animateOut`), shaped like a UI SDK behavior (`bindX(el, options)` returns its cleanup; `createX(context, options)` goes in a primitive's `api`) and built only on UI SDK's public exports: `bindLayer`, `bindDrag`, `animateIn` / `animateOut`, `announce`, `sourceOf`, `isRTL`, and `createVelocityTracker`, `projectDistance` and `rubberBand` from `@ui-sdk/core/gesture`. Popups that stay inside an app's frame are the one thing that needs UI SDK's core itself: that is [Layer hosts](https://blamy.github.io/ui/#/behaviors-layer-hosts), the only behavior our fork adds.

```ts
import { bindSizeClass, sizeClassOf, type SizeClass, type SizeClassBreakpoints } from '@/lib/size-class'
import { SizeClassProvider, useSizeClass, useSizeClassScope, usePresentation } from '@/lib/container'
import { createPageStack, type PageStackExit, type PageStackReason } from '@/lib/stack'
import { bindEdgeSwipe } from '@/lib/edge-swipe'
import { bindBack } from '@/lib/back'
import { bindPullToRefresh } from '@/lib/pull-to-refresh'
import { usePresence, usePresenceList, useEnterExit } from '@/lib/presence'
```

With the npm package each has its own entry, the same path under the package name (`@/lib/stack` is `@brett_lamy/ui/lib/stack`), and as the kit's foundation they are on the root, `@brett_lamy/ui`, too; with the registry, `npx shadcn@latest add https://blamy.github.io/ui/r/stack.json` (and `size-class`, `container`, `edge-swipe`, `back`, `pull-to-refresh`, `scroll-edge`, `presence`, `controllable-state`) copies one into `@/lib`. Use the `bind…` and `create…` ones inside a primitive's slots, or on an element in an effect.

## Already done for you

| Behavior | Where the kit uses it |
| --- | --- |
| `bindSizeClass` + `SizeClassProvider` | `BLProvider`'s root, `SplitView` (which columns exist), `NavigationStack`, `SidebarProvider` (inline or a drawer), `ArtifactChatContainer` (split or stacked). Each one measures its own box and is the size-class scope of what it renders. |
| `usePresentation` | `Dialog` (`"auto"` by default), `Popover`, `DropdownMenu`, `Select`, `Combobox`, `DatePicker`: `presentation="auto"` is a sheet in a compact scope. |
| `createPageStack`, `bindEdgeSwipe`, `bindBack` | [NavigationStack](https://blamy.github.io/ui/#/navigation-stack), [SplitView](https://blamy.github.io/ui/#/split-view) (a stack only while compact), [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane)'s push. `bindEdgeSwipe` alone: AdaptivePane's `swipeToOpen`. |
| `bindPullToRefresh` | `NavigationStackContent onRefresh`. |
| `usePresence`, `usePresenceList`, `useEnterExit` | The Composer's stop button, strip, tiles and cards, `Swap`, `ListSection animate`. |

## Size classes

`bindSizeClass(el, { breakpoints?, onChange? })` follows an element's width (its `clientWidth`, inside the border, without the scrollbar) with a ResizeObserver, names it, and writes the name to the element as `data-size-class`. `onChange` runs at the first measurement and again only when the class changes. A box with no width (not rendered yet, `display: none`) isn't measured: no attribute and no `onChange` until it has one, and once measured, dropping to zero keeps the last class. The cleanup disconnects and puts back the attribute's value from before the bind, so a value you rendered in the markup stays.

| Size class | The element's width |
| --- | --- |
| `compact` | Below `medium` (640px by default) |
| `medium` | From `medium` |
| `regular` | From `regular` (1024px by default) |

`sizeClassOf(width, breakpoints?)` is the same rule as a pure function, for a first render on the server from a width you know or guess.

The attribute is for CSS (`group-data-[size-class=compact]/frame:`). What the kit's components read is the **size-class scope**, a React context: a container that measures its class wraps what it renders in `<SizeClassProvider value={sizeClass}>`, and `useSizeClassScope()` returns the nearest scope's class (`undefined` outside every one; a provider given `undefined`, not measured yet, passes the outer scope through). `useSizeClass({ breakpoints?, initial? })` returns `[ref, sizeClass]`: the class of the element you put `ref` on once it is measured, and before that `initial`, else the nearest scope's, else `regular`. It doesn't provide a scope by itself; wrap the element's children in a `SizeClassProvider` when popups inside should follow it.

The kit's popup wrappers resolve `presentation="auto"` from the scope with `usePresentation(presentation, fallback)` before they hand it to UI SDK: `sheet` in a compact scope, their own presentation (`popover`, `dialog`…) in a medium or regular one, and outside every scope `"auto"` goes through to UI SDK's own rule (`(max-width: 640px) and (pointer: coarse)`). Context crosses portals, so a controlled Dialog with no trigger, written inside a compact SplitView column of a wide app, is a tray even though its content renders into BLProvider's root. The choice is made when the popup opens; resizing the frame while it is open doesn't switch it.

Drag the slider: the frame's layout follows its own width, and Share is a sheet inside the frame while it is compact and a popover from medium up.

{% demo src="behaviors-kit/size-class" %}

```tsx
const frame = definePrimitive({
  name: 'app-frame',
  options: { initialWidth: 'number' },
  state: (options: FrameOptions) => ({ sizeClass: sizeClassOf(options.initialWidth ?? 390, BREAKPOINTS) }),
  api: (context) => ({
    bind: (el: HTMLElement) =>
      bindSizeClass(el, { breakpoints: BREAKPOINTS, onChange: (sizeClass) => context.store.set({ sizeClass }) }),
  }),
  slots: (slot) => ({
    root: slot<object, { sizeClass: SizeClass }>({
      state: (state) => ({ sizeClass: state.sizeClass }),
      // In the markup too: the first paint, and a popup that is open from the start, already see them.
      attrs: (state) => ({ 'data-layer-host': '', 'data-size-class': state.sizeClass }),
      bind: (el, { api }) => api.bind(el),
    }),
  }),
  agent: { actions: [], shown: () => false },
})

<AppFrame className="[contain:layout] …">
  {({ sizeClass }) => (
    <SizeClassProvider value={sizeClass}>
      <Popover presentation="auto">…</Popover>
    </SizeClassProvider>
  )}
</AppFrame>
```

The frame is a layer host too (`data-layer-host` with `contain: layout`), so the sheet stays inside it: see [Layer hosts](https://blamy.github.io/ui/#/behaviors-layer-hosts).

**Nothing remounts when the size class changes.** Switch layouts with CSS on the attribute (or with state that keeps the same elements), so a column keeps its DOM, scroll position and state when the frame crosses a breakpoint.

## Page stacks

`createPageStack(context, options)` is the behavior of a navigation stack: pages that cover each other, pushed and popped with focus, Escape, the platform back and a swipe. It doesn't own state: it reads `state[key]` (the page keys, bottom to top) and `state[exiting]` (pages animating out) from your primitive's store, and every change it asks for goes through your `set`, so `on<Key>Change` hears it with a reason (`trigger-press`, `escape-key`, `back`, `swipe`, `imperative`) and can cancel it. Controlled pages work too: a page the owner popped stays rendered, and plays its exit, in the render before the stack hears of the change.

| Option | What it does |
| --- | --- |
| `key`, `exiting` | The state keys of the pages (`string[]`) and of the pages leaving (`PageStackExit[]`, start `[]`). |
| `set(value, details)` | Writes the pages; pass `createChange`'s. Return `false` to refuse. |
| `back` | Pass `bindBack` for the platform back (it is passed in, so a stack without it doesn't bundle it). |
| `when` | Whether it is a stack right now (default always), as `bindLayer`'s `when`. While it returns `false` the pages stay rendered, nothing pops, the swipe is refused, a change of pages plays no exit and moves no focus, and nothing is covered: a split view's columns are a stack only while compact. Read on every store change. |
| `persistent` | The pages never unmount: the layout's CSS moves them (a split view's columns). A page that leaves records no exit and plays no `animateIn` / `animateOut` (whose reset would clear the `inert` its attrs keep); only focus moves with the pages. Default `false`. |

| Member | What it does |
| --- | --- |
| `push(key, { reason?, event? })` | Puts a page on top; `false` if it is already in the stack or the change was canceled. |
| `pop(details?)` | Takes off the top page; `false` on the first page. |
| `popTo(key, details?)` | Takes off every page above `key`; only the old top animates out. |
| `replace(key, details?)` | Swaps the top page; the old one leaves `covered`. |
| `present(state, key)` | The page slot's `present`: in the stack, or still animating out. |
| `exitOf(state, key)` | The page's `PageStackExit` while it leaves (`{ key, covered }`), else `undefined`. |
| `pageAttrs(state, key)` | The page slot's `attrs`: `tabindex="-1"`, and `inert` with `data-covered` on covered pages. |
| `bindPage(el, key, { initialFocus? })` | The page slot's `bind`: presence and focus. |
| `pops()` | Whether a pop would do anything now (active, and more than one page). |
| `swipe` | `{ onStart, onMove, onEnd }`, to spread into `bindEdgeSwipe`. |

On each page: `data-starting-style` while a pushed page enters, `data-ending-style` while a popped one leaves (it stays rendered until its transitions finish), `data-covered` and `inert` on every page under the top one, `data-swiping` with `--stack-progress` (0 to 1) on the top two pages while a swipe moves, and `data-swipe-settling` on those two from the release until their transitions finish, so the settle can use a different spring from a push or a pop.

Focus moves into a pushed page (to `initialFocus()`, else its first tabbable element, else the page; a touch push focuses the page so the keyboard doesn't open), and back on a pop to the element that had it before that page was pushed. A page needn't be bound to be in the stack: a side drawer's stack is the host's page (a key with no element) and the drawer, and a pop still gives focus back to the opener in the host. Escape goes through UI SDK's layer stack: the stack binds a layer with the public `bindLayer` on a detached element, live (its `when`) only while it can pop, so a popup open inside the page closes first and nested stacks pop innermost first (one registry per page, shared by every copy of the module). Outside presses never pop.

{% demo src="behaviors-kit/nav-stack" %}

```ts
api: (context) => {
  const change = createChange(context)
  const stack = createPageStack<SettingsState, SettingsReason>(context, {
    key: 'pages',
    exiting: 'exiting',
    set: (value, details) => change('pages', value, details),
    back: bindBack,
  })
  return { stack, push: (page: string) => stack.push(page), pop: () => stack.pop() }
},
slots: (slot) => ({
  root: slot({ bind: (el, { api }) => bindEdgeSwipe(el, { ...api.stack.swipe }) }),
  page: slot<{ value: string }>({
    props: { value: 'string' },
    present: (state, { api, key }) => api.stack.present(state, key),
    attrs: (state, { api, key }) => api.stack.pageAttrs(state, key),
    bind: (el, { api, key }) => api.stack.bindPage(el, key, { initialFocus: () => el.querySelector('h2') }),
  }),
  link: slot<{ value: string }>({
    props: { value: 'string' },
    press: ({ api, key }, event) => api.stack.push(key, { reason: 'trigger-press', event }),
  }),
  back: slot({ press: ({ api }, event) => api.stack.pop({ reason: 'trigger-press', event }) }),
}),
```

The motion is CSS on the attributes, on the kit's smooth spring:

```ts
const PAGE = [
  'absolute inset-0 transition-[translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none rtl:[--stack-dir:-1]',
  'data-starting-style:translate-x-[calc(100%*var(--stack-dir,1))] data-ending-style:not-data-covered:translate-x-[calc(100%*var(--stack-dir,1))]',
  'data-covered:translate-x-[calc(-30%*var(--stack-dir,1))]',
  'data-swiping:transition-none data-swiping:not-data-covered:translate-x-[calc(var(--stack-progress)*100%*var(--stack-dir,1))]',
  'data-swiping:data-covered:translate-x-[calc((-30%+var(--stack-progress)*30%)*var(--stack-dir,1))]',
].join(' ')
```

Render every page: each one renders only while it is in the stack or animating out. With a right-to-left page the swipe comes from the right (`side: 'start'`) and `--stack-progress` still grows from 0 to 1, so every offset is times `--stack-dir`, which `rtl:` sets to `-1`: pages enter from the left and follow the finger. The kit's NavigationStack, SplitView and AdaptivePane (its `push` presentation) do the same.

{% hint style="info" %}
A link's target is its `value`, not a `to` prop: a part's key is its `id` or its `value`, and parts of one slot with neither all share one key, so every link would hear the last link's props.
{% endhint %}

## Edge swipes

`bindEdgeSwipe(el, { side?, size?, threshold?, onStart?, onMove?, onEnd? })` follows a swipe in from an edge of `el` and decides whether it finished. `side` is `"start"` by default (left, or right in RTL, read when the press starts; also `"end"`, `"left"`, `"right"`, `"top"`, `"bottom"`), `size` the width of the strip the press must start in (24px; `Infinity` for anywhere), `threshold` the fraction of `el`'s extent to commit (1/3, counting the projected fling).

- It waits 8px of slop and locks the axis: a move along the edge, or toward it, is left to the browser as a scroll for the whole gesture. Set `touch-pan-y` on `el` for a side edge (`touch-pan-x` for top and bottom).
- `onStart({ event })` can refuse (return `false`): the press then acts as if nothing were bound. With bindings nested inside each other, the innermost one whose `onStart` accepts takes the press, and the outer ones never start. `onMove(progress)` reports 0 to 1. `onEnd(committed, { event, velocity })` reports the outcome (`velocity` in px/ms, positive away from the edge); a flick back toward the edge, a `pointercancel`, or the cleanup mid-swipe cancels.
- A committed drag swallows the click on release; a tap stays a click.

It is built on UI SDK's public `bindDrag`, `createVelocityTracker` and `projectDistance(velocity, 0.998)`.

## The platform back

`bindBack(el, { onBack })` hears the system's back while it is bound: bind it only while there is somewhere to go back to inside the page, and the cleanup disarms it. The newest bound consumer hears a back first; return `false` from `onBack` to pass it to the one bound before. On Android it uses one `CloseWatcher`, and skips a `close` that comes within 100ms of an Escape keydown (the layers handled that one). On other touch devices (iOS) it holds one history entry of its own and listens for `popstate` in the capture phase, so the page's router never sees it come or go; a page's own history state is kept as it is (spread when it is a plain object, wrapped otherwise). On a desktop it does nothing, since Escape goes through the layers. One coordinator per window, shared by every copy of the module.

## Pull to refresh

`bindPullToRefresh(scroller, { onRefresh, threshold?, disabled?, pendingAnnouncement? })` refreshes a scroller pulled down from its top with a finger, and holds while the Promise `onRefresh` returns is pending. `onRefresh` gets `{ source, event? }`. Everything is written on the scroller, with no render: `data-pulling` while a finger pulls, `--pull-distance` (the visible pull, rubber-banded, `0px` under reduced motion), `--pull-progress` (0 to 1 at `threshold`, 64px by default; it moves under reduced motion too), and `data-pending` with `aria-busy="true"` while the refresh runs (`pendingAnnouncement`, "Loading" by default, is announced with UI SDK's `announce` after a second). It sets `overscroll-behavior-y: contain`, which turns off the browser's own pull to refresh, and restores it in the cleanup.

A pull starts only at `scrollTop <= 0`, with one finger, outside a nested scroller, and when the first move is mostly downward; anything else is left to the browser for the whole gesture. Its non-passive `touchmove` listener is added only for a touch that can pull, so ordinary scrolling isn't held up. Touch only, so a mouse never pulls: the returned handle is the cleanup and has `refresh()`, for a button or a key.

{% demo src="behaviors-kit/pull-to-refresh" %}

```ts
api: (context) => {
  let pull: ReturnType<typeof bindPullToRefresh> | undefined
  return {
    bind(el: HTMLElement) {
      pull = bindPullToRefresh(el, { onRefresh: () => context.options().onRefresh?.() })
      return pull // the handle is also the cleanup
    },
    refresh: () => pull?.refresh(),
  }
},
```

```tsx
<InboxList className="group/inbox relative h-72 overflow-y-auto">
  <InboxIndicator className="absolute inset-x-0 top-3 opacity-(--pull-progress,0) group-data-pending/inbox:opacity-100" />
  <div className="translate-y-(--pull-distance,0px) transition-[translate] duration-spring-smooth ease-spring-smooth group-data-pulling/inbox:transition-none">…</div>
</InboxList>
```

## Presence

UI SDK's `animateIn(el)` writes `data-starting-style` for an element's first frame, and `animateOut(el, done)` writes `data-ending-style` and calls `done` once its CSS transitions finish; its own popups and toasts use them, but `@ui-sdk/react` has no hook that keeps an element of yours mounted while it leaves. `@/lib/presence` is that hook:

- `usePresence(present, { appear?, instant? })` returns `{ mounted, leaving, ref }`: render while `mounted`, put `ref` on the element, and it stays mounted (and `inert`) through its exit. While `instant` is true it comes and goes at once and plays nothing: a container that hasn't measured itself yet, whose first measurement is where it starts (ArtifactChatContainer until its first layout has painted).
- `usePresenceList(items, keyOf)` returns the items plus the ones that left and are still leaving, each where it was, as `{ key, item, present, appear, exited }`; each child plays its own enter and exit with `useEnterExit(ref, entry.present, { appear: entry.appear, exited: entry.exited })`.

Nothing plays on first paint unless `appear` asks for it (under Strict Mode too: its re-run keeps the enter the first run started), and the motion is CSS on the two attributes, so it can be interrupted and honours reduced motion. See [Motion](https://blamy.github.io/ui/#/motion) for an example.

```tsx
const toast = usePresence<HTMLDivElement>(shown)
return toast.mounted ? (
  <div ref={toast.ref} className="transition-opacity duration-spring-snappy data-starting-style:opacity-0 data-ending-style:opacity-0">…</div>
) : null
```

## Why these aren't in UI SDK

They could be, and we would offer them upstream as optional behaviors (see [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk)), but none of them needs UI SDK's internals: everything they use is public. Keeping them here keeps the fork to the one change that can't be made from outside, and lets the kit shape them for its containers (a stack that is a stack only at some sizes, a swipe-settle hook) without asking upstream first.

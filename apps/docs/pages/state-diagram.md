# StateDiagram

An [XState](https://stately.ai/docs/xstate) machine on a [Diagram](#/diagram). It draws from `machine.root`, which has everything resolved, so relative targets, `#id`s, parallel regions, `always`, `after`, `invoke` and guards are all there. Nothing of the machine runs, unless you ask it to simulate, and then only with stand-ins; with `editable`, it edits the machine's config.

Use a plain [Diagram](#/diagram) with `machineToDraft` and `useDiagramLayout` for a machine drawn your own way, and [DiagramFrame](#/diagram-frame) for a board with a panel of your own. StateDiagram is a composition of those two, not a new kind of board: it's what they're for, made into one component because reading, running and editing a machine need the same three things (a layout, a simulation, a config history) wired together.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/state-diagram.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { StateDiagram } from '@/components/ui/state-diagram'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { StateDiagram } from '@brett_lamy/ui/state-diagram'
```
{% endtab %}
{% endtabs %}

## A machine

{% demo src="state-diagram/machine" %}

```tsx
import { setup } from 'xstate'
import { StateDiagram } from '@/components/ui/state-diagram'

const door = setup({ guards: { hasKey: () => true } }).createMachine({
  id: 'door',
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open', LOCK: { guard: 'hasKey', target: 'locked' } } },
    open: { on: { CLOSE: 'closed' }, after: { 5000: 'closed' } },
    locked: { on: { UNLOCK: 'closed' } },
  },
})

<div className="relative h-96">
  <StateDiagram machine={door} />
</div>
```

| In the machine | On the diagram |
| --- | --- |
| A state that holds others | A compound node, with a marker for its `initial` |
| A `parallel` state | A dashed compound, with a region for each child and a line between them |
| A `final` state | A heavier double border |
| A `history` state | A node that says `history` or `deep history` |
| `invoke` | A second line on its node, and `done` and `error` edges |
| `always` | A dashed edge, labelled with its guard if it has one |
| `after` | A dotted edge, labelled with its delay and guard |
| A transition with no target | A self-loop, as it stays where it is |

## A config

A machine's config is plain data under `setup()`, with its implementations named rather than written in, so it can be saved and loaded as JSON. Pass that as `config`, and it goes through XState's own `createMachine`. If XState won't have it, you see what XState said, not a blank.

{% demo src="state-diagram/config" %}

{% hint style="warning" %}
**XState and ELK are optional peers.** A `config`, simulating and editing all need `xstate`, and laying anything out needs `elkjs`. The shadcn item installs both. With the npm package, `xstate` comes along for now, as docstream uses it, and `elkjs` doesn't, so run `npm install xstate elkjs`, which doesn't leave you relying on that. Without one, the diagram says what to install. ELK's licence is called out on [Attributions](#/attributions).
{% endhint %}

## Simulating

With `simulate`, a copy of the machine runs in the page, with stand-ins for everything it names, so none of your code runs. Where it is becomes the diagram's `current` (marked, and `aria-current` for a screen reader), parallel regions included, and the edges it just took. A panel offers only what it can do next: it asks `snapshot.can` about each event, with the guards answering as you've set them.

{% demo src="state-diagram/simulate" %}

```tsx
<StateDiagram machine={door} simulate />

// Or say how some of it goes. These are read when it starts.
<StateDiagram machine={door} simulate={{ guards: { hasKey: false }, delays: { BACKOFF: 200 } }} />
```

| What it names | What stands in for it |
| --- | --- |
| A guard | A switch in the panel, on by default. One written inline answers yes |
| An action | Nothing happens, and that's the same for `assign` and `raise`, which are code too. What `raise` would've sent is offered for you to send |
| An invoked actor | It waits, and the panel offers how it finished, as `done` or `error` where the machine has somewhere to go. Pass real ones as `actors` |
| A delay | The panel's clock, which only moves when it's told: **Next timer** goes straight to the next one, and **Run** goes by real time. A named delay goes by `delays`, then the machine's own number, then a second |
| Context and output | They aren't there, as they can be code, and nothing's left to read them |

{% hint style="info" %}
**A machine that never settles is stopped, and says so.** A loop through `always` would hang the page if it were real. Here each `always` goes through a guard that counts, and it stops at 2,000 for one event. Timers of no length can go round the same way, so a move of the clock stops at 10,000 of them. Next timer only ever fires one, so you can still step through.
{% endhint %}

{% demo src="state-diagram/simulate-awkward" %}

The panel is a [DiagramFrame](#/diagram-frame)'s: a column beside the board from 720 px wide, a drawer over the board that doesn't dim it from 440 px, so the machine stays in sight while you press its events, and on a phone a page pushed over the board with a back button to it. While it's closed, a bar on the board says where the machine is and opens it. `panelPresentation` forces one, and `panelOpen` / `onPanelOpenChange` control it. The drawer and the push keep to reduced motion. Editing and running at once, the panel has two tabs, **Edit** and **Run**; the run goes on while you look at Edit.

## Editing

With `editable`, what's drawn can be changed, and that writes to the machine's config. A config only names its implementations, so an edit never touches code: rename a guard here and it's a new name for you to write. Saved as JSON and loaded, an edit gives the same graph and the same run.

{% demo src="state-diagram/edit" %}

```tsx
const [config, setConfig] = useState(door.config)

<StateDiagram config={config} onConfigChange={setConfig} editable />
```

| To do this | Do this |
| --- | --- |
| Add a state | **Add state** puts it beside what's selected, or in it if it holds others. **Add one inside** starts holding others |
| Name it | Type in **Name**. Everything that goes to it follows, however it's written: `sibling`, `.child`, `#id.path`, and where its parent starts |
| Say where something starts | **Start here** |
| Connect two states | Select one and drag from a dot on its edge to the other, or press C and use the arrows. It starts off called `EVENT`, and the same two can be connected again |
| Change a transition | Select it, and change its **Event** or its **Guard**, or drag one of its ends. `after`, `always` and `done` go with what their state does, so those can't be renamed or moved to another state |
| Delete something | **Delete**, or the Delete key. A state takes everything inside it, and every transition that goes to any of that |
| Undo | **Undo** and **Redo**, or ⌘Z and ⌘⇧Z from the board. A field keeps those for its own text, and commits on Enter or leaving it; Escape puts it back |

Nothing's moved by dragging, as where things are is ELK's. It's laid out again after each edit, and you'd lose what you'd moved.

{% hint style="warning" %}
**XState decides.** Each edit goes through `createMachine`, and then starts, with stand-ins, as there are things it only finds then. If it won't have it, nothing changes, and you see what it said. So you can't delete where a state starts while there are others in it: choose **Start here** on another first. A state with no others left in it just stops holding any. A machine that never settles isn't refused, as it may be on its way to being something else, and simulating it will tell you.
{% endhint %}

Editing while it's running starts it over on the new machine, with the guards as you'd set them, and the clock stopped. An edit that's refused doesn't touch it.

**What's named with nothing behind it is listed.** The names go by `implementations`, or the machine's own if it has some and you don't pass any. With neither, that's all of them. Code written into a config, like `entry: () => {}`, is listed as well, as JSON can't hold it.

{% demo src="state-diagram/edit-machine" %}

## API

### `<StateDiagram>`

| Prop | Default | Effect |
| --- | --- | --- |
| `machine` | — | A machine, from `createMachine` or `setup(...).createMachine`. |
| `config` | — | Or its config, as JSON. |
| `direction` | `right` | Which way the layers run: `right`, `down`, `left`, `up`. |
| `layout` | — | A layout done ahead of time, on a server perhaps, shown until this one's ready. |
| `simulate` | `false` | Run a copy of it, with a panel. Pass `{ guards, delays, actors }` to say how some of it goes, read when it starts. |
| `editable` | `false` | Let its states and transitions be added, removed and changed. |
| `onConfigChange(config)` | — | The config after each edit, undoing included. With `config`, it's for you to pass it back. |
| `implementations` | the machine's own | What's behind the config's names, as `{ guards, actions, actors, delays }`, so that those with nothing are listed. |
| `defaultSelection` | nothing | What's selected to begin with, while editing. |
| `panelOpen`, `defaultPanelOpen`, `onPanelOpenChange(open, details)` | open where it's a column | Whether the panel shows. |
| `panelPresentation` | `auto` | `auto`, `column`, `drawer` or `push`: as on `DiagramFrame`. |
| `minimap`, `background`, `fitPadding`, `viewport`, `defaultViewport`, `onViewportChange` | as on `Diagram` | Passed to it. |
| `aria-label` | the machine's name | The diagram's name. |
| `className`, `style` | — | Merged onto the frame. |

It's a `DiagramFrame` (with `data-state-diagram`) around a `Diagram`, with a `DiagramToolbar` (zoom and fit; its config has its own undo), a `DiagramFrameBar` and a `DiagramFramePanel`. `state-diagram-error` is the alert when XState or ELK won't have it. The panel is `simulation-panel` (with `data-status`), with `simulation-now`, `simulation-time`, `simulation-guard`, `simulation-log` and `simulation-error` in it, and its buttons are marked `data-action`: `send` (with `data-event`), `finish`, `next-timer`, `run`, `reset`. While editing it's `edit-panel`, with `edit-refusal`, `edit-hint`, `edit-missing` and `edit-inline`; its buttons are `data-action` `add-state`, `undo`, `redo`, `make-start`, `add-inside` and `delete`, and its fields `data-field` `name`, `event` and `guard`. Kit parts keep their own `data-slot`.

## Accessibility

Everything a `Diagram` says, with states called states. Where the machine is has `aria-current`, so a screen reader hears "current" on its states and the edges it just took, and the bar's status says it in words ("In open"). The panel is labelled by its title, its sections by theirs, the run's buttons are named by their events, and a guard's switch says "hasKey answers yes". A refused edit is an alert with what XState said.

### `machineToDraft(machine)`

From `@/lib/state-diagram-model`. A machine as a draft for `useDiagramLayout`, for when you want your own `Diagram`. It reads `machine.root` and nothing else, and doesn't import XState.

### `createSimulation(xstate, config, standIns?, delays?)`

From `@/lib/state-diagram-simulation`. The same simulation with no panel, for a panel of your own or for a test. Pass it XState, so that it doesn't have to import it, and it returns `get`, `subscribe`, `send`, `stepTime`, `advance`, `setGuard`, `reset` and `stop`.

```ts
import * as xstate from 'xstate'

const sim = createSimulation(xstate, door.config)
sim.send('OPEN')
sim.get().now // ['open']
sim.stepTime()
sim.get().now // ['closed']
```

`standInConfig(config)` gives you the copy it runs, and what the machine names.

### `machineEdgeIds(machine)`

From `@/lib/state-diagram-model`. Which edges each transition is drawn as, by the ids `machineToDraft` gives them.

### Changing a config yourself

From `@/lib/state-diagram-edit`, with no panel. Each takes a config and returns a new one, and throws `StateEditRefused`, with the reason, if it can't be done. A place in a machine is what `machineEdgePlaces` and `machineStatePaths` give you.

| Function | What it does |
| --- | --- |
| `addState(config, parent, key)` | Adds a state. If its parent had none, it's where that starts, unless it's parallel |
| `renameState(config, path, key)` | Renames it, and wherever it's written |
| `removeState(config, path)` | Takes it, what's in it, and what goes to any of that |
| `setInitial(config, parent, key)` | Where a state starts |
| `addTransition(config, from, event, to, guard?)` | Adds one, however many there are already |
| `removeTransition(config, place)` | Takes it, or one of its targets if it has more |
| `setTransitionEvent`, `setTransitionGuard`, `setTransitionTarget`, `setTransitionSource` | Change one |
| `removeItems(config, { states, transitions })` | Several at once, as one edit |
| `tryEdit(xstate, config, edit)` | Does an edit and asks XState, and returns `{ ok: true, config, machine }` or `{ ok: false, reason }` |
| `missingImplementations(config, implementations?)` | What's named with nothing behind it |
| `inlineCodeIn(config)` | Where there's code JSON can't hold |

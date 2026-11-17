# StateDiagram

An [XState](https://stately.ai/docs/xstate) machine on a [Diagram](#/diagram): a machine, its config, or its source text, drawn with everything it says, as XState's own visualizer draws it. The machine is a container with its name and its context; a state is a card with its entry and exit actions, what it invokes, its tags and meta as chips; a transition's label is a pill with its event, or a card with its guard and actions. It draws from `machine.root`, which has everything resolved, so relative targets, `#id`s, parallel regions, `always`, `after`, `invoke` and guards are all there. Nothing of the machine runs, unless you ask it to simulate, and then only with stand-ins; with `editable`, it edits the machine's config. Without `editable`, a diagram is a picture you can select in and read: nothing moves, connects or is deleted.

Use a plain [Diagram](#/diagram) with `machineToDraft` and `useDiagramLayout` for a machine drawn your own way, and [DiagramFrame](#/diagram-frame) for a board with a panel of your own. StateDiagram is a composition of those two, not a new kind of board: it's what they're for, made into one component because reading, running and editing a machine need the same three things (a layout, a simulation, a config history) wired together. In Markdown, an ```` ```xstate ```` fence draws the same machine on a read-only StateDiagram ([MarkdownView](#/markdown-view)); see [The xstate fence](#the-xstate-fence) below.

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

## The Audio Player

The machine from XState's visualizer, written as real XState v5 and read from its source: its context (with the types `setup({ types })` gives it) under its name, Paused and Playing with their entry actions as chips, `loaded`, `play`, `pause` and `end` as pills, the transitions with actions as cards, Playing's `restart` and `time` as loops on it, and Error's final square. Run it: the label of what it can take now can be pressed, and sends it.

{% demo src="state-diagram/audio-player" %}

```tsx
const source = `import { setup } from 'xstate';

export const audioPlayer = setup({
  types: { context: {} as { audioRef: string; currentTime: number; trackSource: string; audioContext: string } },
  actions: { onLoad, onError, onPause, onPlay, onRestart, onUpdateTime },
}).createMachine({
  id: 'Audio Player',
  context: { audioRef: '', currentTime: 0, trackSource: '', audioContext: '' },
  initial: 'Init',
  states: {
    Init: { on: { loading: { target: 'Loading', actions: 'onLoad' }, 'init-error': { target: 'Error', actions: 'onError' } } },
    Loading: { on: { loaded: 'Active', error: { target: 'Error', actions: 'onError' } } },
    Active: {
      initial: 'Paused',
      states: {
        Paused: { entry: 'onPause', on: { play: 'Playing', restart: { target: 'Playing', actions: 'onRestart' } } },
        Playing: {
          entry: 'onPlay',
          on: { pause: 'Paused', end: 'Paused', restart: { target: 'Playing', reenter: true, actions: 'onRestart' }, time: { actions: 'onUpdateTime' } },
        },
      },
    },
    Error: { type: 'final' },
  },
});`

<StateDiagram source={source} simulate />
```

## What is drawn

Every part of an XState v5 machine has a drawn form. The machine runs top to bottom on a lined board, in the kit's tokens, radii and type scale, light and dark.

| In the machine | On the diagram |
| --- | --- |
| The machine (`id`, or `meta.title`) | The root container, its header strip the machine's name; `description` under it |
| `context` | A **Context** section under the machine's header, in the mono face: each key with its type (from `types.context`, read from source) or its value as written (`0`, `""`, `null`, `[3 items]`); a context made by code says nothing it can't know |
| A state | A card: a header strip with its name. A state with nothing more to say is only its header |
| `entry`, `exit` | **Entry actions**, **Exit actions** sections of chips, each with a bolt |
| An action by name, `{ type, params }` | A chip with its name, and its params after it (`track` · `screen: "home"`) |
| `assign`, `raise`, `sendTo`, `sendParent`, `log`, `emit`, `spawnChild`, `stopChild`, `cancel`, `enqueueActions` | A chip named as the built-in it is, with what it does after it (`assign` · `currentTime`, `raise` · `READY`, `sendTo` · `HI to logger`) |
| Code written inline | A quiet chip, `inline`, or the function's own name |
| `invoke` | An **Invoke** section: the actor's `src` (or `actor`, for one written inline), its `id` and its `input` when they're data; its `onDone`, `onError`, `onSnapshot` are edges labelled `src: done`, `src: error` |
| `tags` | A **Tags** section of chips |
| `meta` | A **Meta** section, a row per key |
| `description` | A quiet paragraph under the header |
| A compound state | A container with the same header strip, its children inside |
| `initial` | An entry marker on the state it starts in: a dot with a curved arrow into its corner |
| A `parallel` state | A dashed container with a `parallel` badge, its regions side by side with a rule between them, each with its own start |
| A `final` state | A square in its header, and a hairline inside its border in the border's color: quiet, so it isn't read as selected or focused |
| A `history` state | `H` in its header (shallow), `H*` (deep) |
| A transition with only an event | A fully rounded pill on the edge |
| One with a guard, actions, or more | A small card on the edge: the event on top, then chips: the guard as a condition (`if canRetry`, `if isAbove(min: 5)`, `if a and (b or not c)`, `if in #m.on`), its actions; and how it goes (`reenters`, `no target`, `2 targets`) as a quiet line under them, a modifier rather than a chip |
| `after` | A dotted edge whose label has a clock: `after 500 ms`, `after BACKOFF` |
| `always` | A dashed edge labelled `always` |
| The state's own `onDone` | An edge labelled `done` |
| `*` | An edge labelled `*` |
| `reenter: true` | A quiet `reenters` line under its chips; to itself, a loop |
| A transition with no target | A loop on its state with a quiet `no target` line under its chips: it stays and only runs its actions |
| Several targets | One label (with a quiet `2 targets` line under its chips) that forks: the line runs from the state into the label and out of it, and splits to each target; the edges past the first share its label (Diagram's `forkOf`) |
| `on` at the machine's root | Edges from the machine's container: each starts at a dot on the line under its Context, where its sections end |

{% demo src="state-diagram/anatomy" %}

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

## A config

A machine's config is plain data under `setup()`, with its implementations named rather than written in, so it can be saved and loaded as JSON. Pass that as `config`, and it goes through XState's own `createMachine`. If XState won't have it, you see what XState said, not a blank. `config` is controlled: what you pass is what's shown, and an edit is handed to `onConfigChange` for you to pass back. `defaultConfig` is a config to start from that the diagram keeps, so an edit shows at once.

{% demo src="state-diagram/config" %}

{% hint style="warning" %}
**XState and ELK are optional peers.** A `config`, `source`, simulating and editing all need `xstate`, and laying anything out needs `elkjs`. The shadcn item installs both; with the npm package, run `npm install xstate elkjs`. Without one, the diagram says what to install. ELK's licence is called out on [Attributions](#/attributions).
{% endhint %}

## A machine's source

`source` takes a machine as it's written: TypeScript with one `createMachine({…})` or `setup(…).createMachine({…})`, a config object, or JSON. It's read, never run, by `parseXState`: states, targets, `on`, `after`, `always`, `invoke`'s name, id, input and where it goes, guards (named, with params, `and` / `or` / `not` / `stateIn`), `entry`, `exit` and `actions` (by name, built-ins as what they are, code as `inline`), `tags`, `description`, `meta`, `context` and the context's types from `types`; what's code in any of it is left out, never run. What can't be read without running it, like `states: getStates()`, is refused with why. It's the same reading as the xstate fence's.

{% demo src="state-diagram/source" %}

```tsx
<StateDiagram source={text} simulate />
```

## Simulating

With `simulate`, a copy of the machine runs in the page, with stand-ins for everything it names, so none of your code runs. Where it is becomes the diagram's `current` (a bar on the state's start side and a line, and `aria-current` for a screen reader), parallel regions included, and the edges it just took. The label of each transition it can take now can be pressed (Diagram's `pressable`): it has a primary ring two lines thick and a play badge on its corner, so it isn't told by color alone, and its edge says "It can be sent now" to a screen reader. Press it, or Enter on its edge, and its event is sent. It's the Diagram's own label, so it's wherever the label is. The panel offers the same and more: it asks `snapshot.can` about each event, with the guards answering as you've set them, and shows the machine's context as it is now.

{% demo src="state-diagram/simulate" %}

```tsx
<StateDiagram machine={door} simulate />

// Or say how some of it goes. These are read when it starts.
<StateDiagram machine={door} simulate={{ guards: { hasKey: false }, delays: { BACKOFF: 200 } }} />
```

| What it names | What stands in for it |
| --- | --- |
| A guard | A switch in the panel, on by default. One written inline answers yes |
| An action | Nothing happens, and that's the same for XState's built-ins, but for an `assign` of values written out (`assign({ currentTime: 0 })`), which sets them. What `raise` would've sent is offered for you to send |
| An invoked actor | It waits, and the panel offers how it finished, as `done` or `error` where the machine has somewhere to go. Pass real ones as `actors` |
| A delay | The panel's clock, which only moves when it's told: **Next timer** goes straight to the next one, and **Run** goes by real time. A named delay goes by `delays`, then the machine's own number, then a second |
| A guard made of others (`and`, `or`, `not`, `stateIn`) | One switch, named by what it says (`a and not b`) |
| Context | Kept when it's data, and shown in the panel's **Context** as it changes; one made by code isn't there. Output isn't there |

{% hint style="info" %}
**A machine that never settles is stopped, and says so.** A loop through `always` would hang the page if it were real. Here each `always` goes through a guard that counts, and it stops at 2,000 for one event. Timers of no length can go round the same way, so a move of the clock stops at 10,000 of them. Next timer only ever fires one, so you can still step through.
{% endhint %}

{% demo src="state-diagram/simulate-awkward" %}

It opens readable from its top-start corner, where the machine's name and Context are, in the part of the board the panel and the bar leave. What has the eye stays in that part of the board: what's selected, or while simulating the state(s) it's in and the transition it just took (whichever changed last), with the labels of the events it can send now when they fit. When the panel opens or closes beside or over the board, when the machine moves, or when something's selected from outside the board (the panel's Add state, `selection`, `defaultSelection`), the view pans by the least that brings it wholly into view, and keeps the machine's name and Context too when they're in view and both can be read at once (zooming out as far as 87.5% for it); something already in view doesn't move. At 800 × 1000 with the panel open as a column, the Audio Player's Init and its two sendable labels need 612 px beside its Context at 87.5%, and the board has 464: what can be sent stays, and the name slides off. On a phone it opens on the name and Context, and simulating brings the current state in. In the panel, a context key's field is over its value's, each as wide as the panel, so a key reads whole.

The panel is a [DiagramFrame](#/diagram-frame)'s: a column beside the board from 720 px wide, a drawer over the board that doesn't dim it from 440 px, so the machine stays in sight while you press its events, and on a phone a page pushed over the board with a back button to it. While it's closed, a bar on the board says where the machine is and opens it. `panelPresentation` forces one, and `panelOpen` / `onPanelOpenChange` control it. The drawer and the push keep to reduced motion. Editing and running at once, the panel has two tabs, **Edit** and **Run**; the run goes on while you look at Edit.

## Editing

With `editable`, what's drawn can be changed, and that writes to the machine's config. A config only names its implementations, so an edit never touches code: rename a guard here and it's a new name for you to write. Saved as JSON and loaded, an edit gives the same graph and the same run.

{% demo src="state-diagram/edit" %}

```tsx
// Uncontrolled: the diagram keeps the config, and edits show at once.
<StateDiagram defaultConfig={door.config} editable onConfigChange={(config, details) => save(config)} />

// Controlled: what you pass back is what it shows.
const [config, setConfig] = useState(door.config)
<StateDiagram config={config} onConfigChange={setConfig} editable />
```

| To do this | Do this |
| --- | --- |
| Add a state | **Add state** puts it beside what's selected, or in it if it holds others. **Add one inside** starts holding others |
| Name it | Type in **Name**. Everything that goes to it follows, however it's written: `sibling`, `.child`, `#id.path`, and where its parent starts |
| Say where something starts | **Start here** |
| Connect two states | Select one and drag from a dot on its edge to the other, or press C and use the arrows. It starts off called `EVENT`, and the same two can be connected again |
| Change a transition | Select it, and change its **Event**, its **Guard** or its **Actions**, or drag one of its ends. `after`, `always` and `done` go with what their state does, so those can't be renamed or moved to another state |
| Entry and exit actions | Select a state: **Entry actions** and **Exit actions** list them, each by name in a field (Enter renames it, keeping its params), with a remove button, and **Add**. Code and XState's built-ins can be removed but have no name in the config to change |
| Context | With nothing selected, **Context** lists the machine's keys: rename one, set its starting value (JSON, or text as it is), remove it, or **Add key**. A context made by code can't be changed here |
| Open a chip | Press a chip on the board (an action, a guard, a context key): its state or transition is selected and its field in the panel has focus |
| Delete something | **Delete**, or the Delete key. A state takes everything inside it, and every transition that goes to any of that |
| Undo | **Undo** and **Redo** on the board's toolbar, or ⌘Z and ⌘⇧Z (⌘Y) on the board. They undo the config, as the Diagram's `history`, the same toolbar and keys as every diagram. A field keeps those keys for its own text, and commits on Enter or leaving it; Escape puts it back |

Nothing's moved by dragging, as where things are is ELK's. It's laid out again after each edit, and you'd lose what you'd moved.

{% hint style="warning" %}
**XState decides.** Each edit goes through `createMachine`, and then starts, with stand-ins, as there are things it only finds then. If it won't have it, nothing changes, and you see what it said: under the field you changed, or at the top of the panel for something done on the board. So you can't delete where a state starts while there are others in it: choose **Start here** on another first. A state with no others left in it just stops holding any. A machine that never settles isn't refused, as it may be on its way to being something else, and simulating it will tell you.
{% endhint %}

Editing while it's running starts it over on the new machine, with the guards as you'd set them, and the clock stopped. An edit that's refused doesn't touch it.

**What's named with nothing behind it is listed.** The names go by `implementations`, or the machine's own if it has some and you don't pass any. With neither, that's all of them. Code written into a config, like `entry: () => {}`, is listed as well, as JSON can't hold it.

{% demo src="state-diagram/edit-machine" %}

## The xstate fence

In Markdown, an ```` ```xstate ```` fence draws its machine with this component, read-only ([MarkdownView](#/markdown-view), the BL site's docstream pages, and the editor's preview): the same `parseXState`, the same `machineToDraft`, the same picture. It loads `@brett_lamy/ui/state-diagram` (and with it XState and ELK) only when a fence is shown. Where it can't load, the fence shows its text form, a Mermaid statechart in UML's notation from the same model (`xstateToMermaid` on `@brett_lamy/ui/docstream/xstate/machine`).

| | StateDiagram | The xstate fence |
| --- | --- | --- |
| Reads | a machine, a config or source | source |
| Draws | everything in [What is drawn](#what-is-drawn) | the same |
| Simulates, edits | with `simulate`, `editable` | no: it's a picture to read, select in and zoom |
| Loads | XState and ELK when there's something to draw | the StateDiagram itself, too, when the fence is shown |

## API

### `<StateDiagram>`

| Prop | Default | Effect |
| --- | --- | --- |
| `machine` | — | A machine, from `createMachine` or `setup(...).createMachine`. |
| `source` | — | Or its source text, TypeScript or JSON, read without running it. |
| `config` | — | Or its config, as JSON, controlled. |
| `defaultConfig` | — | Or a config to start from, kept by the diagram. |
| `direction` | `down` | Which way the layers run: `down`, `right`, `up`, `left`. |
| `density` | `default` | How much room the layout leaves between things: `compact` for a big machine (the 33 states below), `default`, `comfortable`. |
| `layout` | — | A layout done ahead of time, on a server perhaps, shown until this one's ready. |
| `simulate` | `false` | Run a copy of it, with a panel. Pass `{ guards, delays, actors }` to say how some of it goes, read when it starts. |
| `editable` | `false` | Let its states and transitions be added, removed and changed. |
| `onConfigChange(config, details)` | — | The config after each edit, undoing included, with `details.reason` (`edit`, `undo`, `redo`). With `config`, it's for you to pass it back; otherwise `details.cancel()` refuses it. |
| `implementations` | the machine's own | What's behind the config's names, as `{ guards, actions, actors, delays }`, so that those with nothing are listed. |
| `selection`, `defaultSelection`, `onSelectionChange(selection, details)` | nothing | What's selected, `{ nodes, edges }` by the ids `machineToDraft` gives, as on Diagram. Read-only too. |
| `onAction(item, details)` | — | A state, a transition or a chip was activated (Enter, double-click, a press on a chip while editing, a press on a label it can send), as on Diagram. A press on, or Enter on, a transition it can take while simulating also sends it. |
| `panelOpen`, `defaultPanelOpen`, `onPanelOpenChange(open, details)` | open where it's a column | Whether the panel shows. |
| `panelPresentation` | `auto` | `auto`, `column`, `drawer` or `push`: as on `DiagramFrame`. |
| `background` | `grid` | The board: `grid` (lines), `dots`, `none`. |
| `minimap` | `auto` | Diagram's: `auto` shows it while a good part of the machine is out of view at a readable size, on a board with room for it. |
| `fitPadding`, `viewport`, `defaultViewport`, `onViewportChange` | as on `Diagram` | Passed to it. |
| `aria-label` | the machine's name | The diagram's name. |
| `className`, `style` | — | Merged onto the frame. |

It's a `DiagramFrame` (with `data-state-diagram`) around a `Diagram`, with a `DiagramToolbar` (zoom and fit, and while editing undo and redo, of the config), a `DiagramFrameBar` and a `DiagramFramePanel`. When XState, ELK or the source reader won't have it, that's the Diagram's `error`, its `diagram-error` alert. The panel is `simulation-panel` (with `data-status`), with `simulation-now`, `simulation-context` (a row per key, `data-key`), `simulation-time`, `simulation-guard`, `simulation-log` and `simulation-error` in it, and its buttons are marked `data-action`: `send` (with `data-event`), `finish`, `next-timer`, `run`, `reset`. On the board, a transition it can take now is a `diagram-edge-label` with `data-pressable` (and its badge, `[data-part=press]`). While editing it's `edit-panel`, with `edit-refusal` (a refusal of something done on the board, on the kit's callout), `edit-hint`, `edit-missing` and `edit-inline`; its buttons are `data-action` `add-state`, `make-start`, `add-inside`, `delete`, `add-entry`, `add-exit`, `add-actions`, `add-context` and `remove`, a list of actions is `edit-actions` (`data-actions="entry|exit|actions"`) and the context `edit-context`, and its fields `data-field` `name`, `event`, `guard`, `entry:<i>`, `exit:<i>`, `actions:<i>`, `context:<key>` and `value:<key>`, each a `Field` whose `FieldError` says why an edit to it was refused. Kit parts keep their own `data-slot`.

## Accessibility

Everything a `Diagram` says, with states called states, and what each does ("On entry: onPlay."); a transition is named in statechart notation (`restart [canRetry] / onRestart`), and one that can be sent now says so ("It can be sent now: press Enter"). A chip says what it is and whose ("onPause, Entry actions, in Paused"). Where the machine is has `aria-current`, so a screen reader hears "current" on its states and the edges it just took, and the bar's status says it in words ("In open"). The panel is labelled by its title, its sections by theirs, the run's buttons are named by their events, and a guard's switch says "hasKey answers yes". A refused edit says what XState said: a field's as its `FieldError`, tied to the field, which is marked invalid; one from the board as an alert at the top of the panel. While the panel is a drawer over the board, the state it's in is moved out from under it.

### `parseXState(code)`

From `@brett_lamy/ui/lib/state-diagram-source` (`@/lib/state-diagram-source`). A machine's config from its source, TypeScript or JSON, without running any of it; it throws with why when it can't. It loads Babel's parser, so StateDiagram loads it only when there's a `source`.

### `machineToDraft(machine)`

From `@brett_lamy/ui/lib/state-diagram-model` (`@/lib/state-diagram-model`). A machine as a draft for `useDiagramLayout`, for when you want your own `Diagram`: the anatomy in the table above, as Diagram's `title`, `icon`, `trailing`, `description`, `sections` and `entry` on each node and `title`, `icon` and `sections` on each edge. It reads `machine.root` and its config and nothing else, and doesn't import XState. Each node's `data` (`StateNodeData`) has what the state says: `type`, `history`, `initial`, `entry`, `exit`, `invoke`, `tags`, `description`, `meta`, and on the root, `context`. Each edge's (`StateEdgeData`) has `transition` (`event`, `after`, `done`, `invoke`, `always`), `event`, `name`, `guard`, `actions`, `delay`, `actor`, `reenter`, `internal` and `targets`. The statechart look is a preset on Diagram's generic looks, `STATE_NODE_LOOK` and `STATE_EDGE_LOOK` (a compound state is a `group`, `dashed` when parallel; a final state a `node` with a `double` border; `always` `dashed`, `after` `dotted`), and its glyphs are `STATE_GLYPHS`. `describeMachine`, `describeAction` and `describeGuard` read the pieces; `stateSections` and `transitionSections` make the sections; `transitionNotation` writes a transition as `event [guard] / action`.

### `createSimulation(xstate, config, standIns?, delays?)`

From `@brett_lamy/ui/lib/state-diagram-simulation` (`@/lib/state-diagram-simulation`). The same simulation with no panel, for a panel of your own or for a test. Pass it XState, so that it doesn't have to import it, and it returns `get`, `subscribe`, `send`, `stepTime`, `advance`, `setGuard`, `reset` and `stop`.

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

From `@brett_lamy/ui/lib/state-diagram-model`. Which edges each transition is drawn as, by the ids `machineToDraft` gives them.

### Changing a config yourself

From `@brett_lamy/ui/lib/state-diagram-edit` (`@/lib/state-diagram-edit`), with no panel. Each takes a config and returns a new one, and throws `StateEditRefused`, with the reason, if it can't be done. A place in a machine is what `machineEdgePlaces` and `machineStatePaths` give you.

| Function | What it does |
| --- | --- |
| `addState(config, parent, key)` | Adds a state. If its parent had none, it's where that starts, unless it's parallel |
| `renameState(config, path, key)` | Renames it, and wherever it's written |
| `removeState(config, path)` | Takes it, what's in it, and what goes to any of that |
| `setInitial(config, parent, key)` | Where a state starts |
| `addTransition(config, from, event, to, guard?)` | Adds one, however many there are already |
| `removeTransition(config, place)` | Takes it, or one of its targets if it has more |
| `setTransitionEvent`, `setTransitionGuard`, `setTransitionTarget`, `setTransitionSource` | Change one |
| `addAction(config, at, name)`, `renameAction(config, at, index, name)`, `removeAction(config, at, index)` | A state's `entry` or `exit` (`at: { state, slot }`), or a transition's `actions` (`at: { transition }`) |
| `addContextKey(config, key, value?)`, `renameContextKey`, `setContextValue`, `removeContextKey` | The machine's context, and its types with it |
| `removeItems(config, { states, transitions })` | Several at once, as one edit |
| `tryEdit(xstate, config, edit)` | Does an edit and asks XState, and returns `{ ok: true, config, machine }` or `{ ok: false, reason }` |
| `missingImplementations(config, implementations?)` | What's named with nothing behind it |
| `inlineCodeIn(config)` | Where there's code JSON can't hold |

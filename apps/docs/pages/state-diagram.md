# StateDiagram

An [XState](https://stately.ai/docs/xstate) machine on a [Diagram](#/diagram). It draws from `machine.root`, which has everything resolved, so relative targets, `#id`s, parallel regions, `always`, `after`, `invoke` and guards are all there. Nothing of the machine runs.

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { StateDiagram } from '@brett_lamy/ui'
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
**XState and ELK are optional peers.** A `config` needs `xstate`, and laying anything out needs `elkjs`. The shadcn item installs both. With the npm package, run `npm install xstate elkjs`. Without them it says what to install. ELK's licence is called out on [Attributions](#/attributions).
{% endhint %}

## Simulating

With `simulate`, a copy of the machine runs in the page, with stand-ins for everything it names, so none of your code runs. Where it is gets lit, parallel regions included, and the edges it just took. A panel offers only what it can do next: it asks `snapshot.can` about each event, with the guards answering as you've set them.

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

The panel sits beside the board at 560 px wide or more. Narrower than that, it's a [Credenza](#/credenza) tray that's closed to begin with, and it takes the bottom of the space, with the board fitted above it so that you can watch it. Nothing about it moves other than what the tray and the buttons do themselves, and they keep to reduced motion.

## API

### `<StateDiagram>`

| Prop | Default | Effect |
| --- | --- | --- |
| `machine` | — | A machine, from `createMachine` or `setup(...).createMachine`. |
| `config` | — | Or its config, as JSON. |
| `direction` | `RIGHT` | Which way the layers run. |
| `initial` | — | A layout done ahead of time, on a server perhaps. |
| `simulate` | `false` | Run a copy of it, with a panel. Pass `{ guards, delays, actors }` to say how some of it goes, read when it starts. |
| `defaultPanelOpen` | if it fits beside the board | Whether the panel starts open. |
| `minimap`, `background`, `fitPadding`, `camera`, `defaultCamera`, `onCameraChange` | as on `Diagram` | Passed to it. |
| `aria-label` | the machine's name | The region's name. |
| `className`, `style` | — | Merged onto the root. |

The root carries `data-slot="state-diagram"`, with `state-diagram-error` and `state-diagram-status` in it when they're needed. Under them it's a `Diagram`. The panel is `simulation-panel`, with `simulation-now`, `simulation-event`, `simulation-finish`, `simulation-next`, `simulation-run`, `simulation-time`, `simulation-guard`, `simulation-reset`, `simulation-log` and `simulation-error` in it, and `simulation-bar` is what opens it.

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

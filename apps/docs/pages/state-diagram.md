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

## API

### `<StateDiagram>`

| Prop | Default | Effect |
| --- | --- | --- |
| `machine` | — | A machine, from `createMachine` or `setup(...).createMachine`. |
| `config` | — | Or its config, as JSON. |
| `direction` | `RIGHT` | Which way the layers run. |
| `initial` | — | A layout done ahead of time, on a server perhaps. |
| `minimap`, `background`, `fitPadding`, `camera`, `defaultCamera`, `onCameraChange` | as on `Diagram` | Passed to it. |
| `aria-label` | the machine's name | The region's name. |
| `className`, `style` | — | Merged onto the root. |

The root carries `data-slot="state-diagram"`, with `state-diagram-error` and `state-diagram-status` in it when they're needed. Under them it's a `Diagram`.

### `machineToDraft(machine)`

From `@/lib/state-diagram-model`. A machine as a draft for `useDiagramLayout`, for when you want your own `Diagram`. It reads `machine.root` and nothing else, and doesn't import XState.

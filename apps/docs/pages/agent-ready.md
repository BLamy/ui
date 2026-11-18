# Agent-ready components

Every BL UI component is built on UI SDK, so an AI agent can read and operate it without screenshots. The agent sees a list of the page's components, each with its name, kind, value, choices and the actions it takes. It changes them through the components' own APIs, the same calls a person's click or key press ends in. Your app sees each change through its normal callbacks, with `details.source === "agent"`, and can refuse it.

## How the kit exposes components

UI SDK's agent bridge (`createAgent` from `@brett_lamy/ui/sdk/react/agent`) finds every UI SDK part on the page. A kit component is listed under its UI SDK kind:

| Kit component | Kind in the snapshot | Actions |
| --- | --- | --- |
| `Button` | `button` | `press` |
| `Switch`, `Checkbox` | `switch`, `checkbox` | `setChecked` |
| `RadioGroup`, `Segmented`, `Tabs` | `radio`, `segmented-control`, `tabs` | `setValue` (an item's value or label) |
| `Slider` | `slider` | `setValue` (a number, or text like `"40%"`) |
| `Input` in a `Field` | `input` | `setValue`, `clear` |
| `Select`, `Combobox` | `select`, `combobox` | `setValue`, `setOpen`, `setQuery`, `clear` |
| `DropdownMenu` | `menu` | `press` with an item's text, `setOpen` |
| `Dialog`, `AlertDialog`, `Sheet`, `Popover` | `dialog`, `alert-dialog`, `drawer`, `popover` | `press` with a button's text (opens it first), `setOpen` |
| `DisclosureGroup` | `accordion` | `open`, `close`, `toggle`, `setValue` |
| `Tree` | `tree` | `setValue`, `expand`, `collapse`, `setChecked` |
| `DatePicker` | `date-picker` | `setValue` (`YYYY-MM-DD`), `next`, `previous`, `setOpen` |
| `ColorPicker` | `color-picker` | `setValue` (a CSS color) |
| `CommandMenu` | `command` | `setQuery`, `setValue` (highlight), `setPages` |
| `FileUpload` | `file-input` | `addFiles`, `removeFile`, `clear` |

The name is the accessible name, so name controls the way a person would say them:

- Wrap a control in a `Field` with a `FieldLabel`, or give it `aria-label` / `aria-labelledby`.
- Name an item by its visible text. Give a popup's confirming button text that differs from its trigger's, like "Delete forever" for a "Delete project" trigger.
- Put `data-agent-confirm="Deletes the project and its files"` on anything an agent must not do alone, on the confirming button (`AlertDialogClose value="delete"`), not on the trigger.
- Use the kit's parts for anything an agent should use. A plain `<button>` or `<input>` is invisible to it.

{% hint style="info" %}
Keep app state in change callbacks (`onValueChange`, `onCheckedChange`, `onOpenChange`). An agent's change calls the component's API, so `onClick` or `onKeyDown` checks never see it.
{% endhint %}

## Connect an agent

Create the bridge once, in the browser, before you render:

```ts title="agent.ts"
import { agentTools, createAgent, registerTools } from '@brett_lamy/ui/sdk/react/agent'

export const agent = createAgent({
  // Steps on a data-agent-confirm control ask the person first.
  allow: (step, { signal }) => (step.confirm ? askThePerson(step.confirm, { signal }) : true),
})

// A browser agent (WebMCP): the bridge's own allow already asks, so let every step through here.
registerTools(agent, { allow: () => true })
```

To use your own model, hand it `agentTools` (the `snapshot`, `act` and `query` tools with their JSON Schemas) and route each tool call to the method of the same name on `agent`, returning the result to the model. `tools/agent-test/run.mjs` in this repo is a complete loop for the OpenAI API.

```ts title="A step list an agent sends"
await agent.act({
  steps: [
    { ref: 'Notifications', action: 'setChecked', args: [true] },
    { ref: 'Volume', action: 'setValue', args: [40] },
    { ref: 'Delete project', action: 'press', args: ['Delete forever'] },
  ],
})
```

## Test it

The kit has two test layers.

{% stepper %}
{% step %}
### Deterministic: vitest, no network

`packages/ui/src/agent/agent.*.test.tsx` render representative compositions of each component family inside `BLProvider` (happy-dom), take a snapshot, assert every control is listed with a name, kind and value, drive each one with `act`, and assert the component changed and reported `details.source === "agent"`. The AlertDialog test flips `allow` to check that a confirmed press is refused and then runs.

```sh lineNumbers="false"
cd packages/ui && pnpm exec vitest run src/agent
```

A known gap is written as `it.fails` with a one-line reason. It turns red once the gap is fixed, so the marker gets removed.
{% endstep %}
{% step %}
### Model-driven: a real model through OpenAI

`tools/agent-test/run.mjs` serves small scenario pages built from the kit (`tools/agent-test/page/`) and gives a model a goal for each, like "Turn on notifications and set the volume to 40" or "Delete the project and confirm". The model gets only the three agent tools and their results. The runner then checks the page's recorded app state.

```sh lineNumbers="false"
pnpm agent-test                  # every scenario
pnpm agent-test settings rename  # some of them
AGENT_TEST_MODEL=gpt-5.4-mini pnpm agent-test
```

It reads `OPENAI_API_KEY` from the environment or from `.env.local`, and skips cleanly (exit 0) without one. Without `AGENT_TEST_MODEL` it picks the newest `gpt-*-mini` model from the account's model list and prints which one it used. Each scenario reports pass or fail, turns, tokens, and whether a step needed a retry. The JSON report goes to `tools/agent-test/.results/`, and the run exits 1 if any scenario fails.
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
The model-driven run sends the scenario pages' component snapshots to OpenAI, and nothing else. Hard caps (8 model calls and 40k tokens per scenario, 300k per run) keep a full run at around 50k tokens.
{% endhint %}

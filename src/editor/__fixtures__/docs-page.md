# Button

A **bold** claim, _emphasis_, `inline code`, ~~struck~~ and a [link](https://example.com). Ask @brett about #buttons [^1].

## Install

{% tabs sync="pm" %}
{% tab title="npm" %}
```sh
npm install @brett_lamy/ui
```
{% endtab %}

{% tab title="pnpm" %}
```sh
pnpm add @brett_lamy/ui
```
{% endtab %}
{% endtabs %}

{% hint style="warning" %}
Buttons need a **label**.

- even icon buttons
- use `aria-label`
{% endhint %}

{% tabs title="Installation" sync="install-method" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once, then the parts:

```tsx
import '@brett_lamy/ui/styles.css'
import { Button } from '@brett_lamy/ui'
```
{% endtab %}

{% tab title="shadcn CLI" %}
{% command pnpm="pnpm dlx shadcn@latest add button" %}npx shadcn@latest add https://example.com/r/button.json{% endcommand %}
{% endtab %}
{% endtabs %}

{% command %}
npm install -D vitest
npm run test -- --watch
{% endcommand %}

## Usage

```tsx title="App.tsx"
import { Button } from "@brett_lamy/ui"

export default function App() {
  return <Button>Save</Button>
}
```

```ts lineNumbers="false"
const quiet = true
```

{% demo src="button/sizes" title="Sizes" height="320" variants="sm:Small,lg:Large" %}

{% demo src="composer/scroll-fab" title="Scroll → FAB" description="Scroll the list; the button **shrinks**." height="380" variants="full:Full,compact:Compact" viewport="tablet" %}
```tsx title="index.tsx"
import { messages } from "./data"

export default function ScrollFab({ variant = "full" }: { variant?: string }) {
  return <ul data-variant={variant}>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
}
```
```ts title="data.ts"
export const messages = ["one", "two", "three"]
```
````md title="README.md"
Run it:

```sh
npm start
```
````
{% enddemo %}

{% tabs %}
{% tab title="Preview" %}
{% demo src="button/ghost" %}
{% endtab %}

{% tab title="Notes" %}
Ghost buttons sit on busy surfaces.
{% endtab %}
{% endtabs %}

## API

| Prop | Type | Default |
| --- | --- | --- |
| `variant` | `"solid" \| "ghost"` | `"solid"` |
| `size` | `"sm" \| "lg"` | `"sm"` |

<table data-view="cards"><thead><tr><th>Title</th><th>Body</th></tr></thead><tbody><tr><td><strong>Solid</strong></td><td>Primary actions</td></tr><tr><td><strong>Ghost</strong></td><td>Secondary actions</td></tr></tbody></table>

{% source-ref mount="demo" path="Button.tsx" export="Button" kind="component" title="Button component" %}

{% source-ref mount="demo" path="Button.stories.tsx" export="Primary" kind="story" %}

{% stepper %}
{% step %}
### Install

Add the package.
{% endstep %}

{% step %}
### Import

Import the component.
{% endstep %}
{% endstepper %}

{% columns %}
{% column %}
Left column.
{% endcolumn %}

{% column %}
Right column.
{% endcolumn %}
{% endcolumns %}

<details>

<summary>Why not a link?</summary>

Links navigate; buttons act.

</details>

1. First
2. Second
  - nested bullet

- [x] Done
- [ ] Todo

> Buttons are verbs.

---

$$
E = mc^2
$$

```mermaid
graph TD
  A --> B
```

<figure><img src="button.png" alt="A button"><figcaption><p>The default button</p></figcaption></figure>

{% embed url="https://www.youtube.com/watch?v=8aGhZQkoFbQ" title="Talk" %}

{% content-ref url="card.md" %}
[Card](card.md)
{% endcontent-ref %}

{% updates format="full" %}
{% update date="2026-09-01" %}
Added the ghost variant.
{% endupdate %}
{% endupdates %}

{% openapi-operation spec="petstore" path="/pets" method="get" %}
[petstore](https://petstore3.swagger.io/api/v3/openapi.json)
{% endopenapi-operation %}

[^1]: https://example.com/buttons "Button guidelines"

/* What the "model" streams for each variant. Plain docstream Markdown — the same text an
   LLM would emit. `F` is a code fence, so the scripts read without escaped backticks. */
const F = "```"

export const SCRIPTS: Record<string, string> = {
  answer: `## Which flavors should we push this summer?

**Pistachio** is your strongest seasonal climber — up 18% quarter over quarter [^1], with the sharpest lift on weekend afternoons [^2]. Rocky Road keeps sliding [^3].

{% hint style="info" %}
The hint renders the moment its opening tag arrives — before \`endhint\` has streamed in.
{% endhint %}

| Flavor | QoQ | Signal |
| --- | --- | --- |
| Pistachio | +18% | Search interest at a 3-year high |
| Mango sorbet | +9% | Strong in the south-west |
| Rocky Road | −6% | Losing shelf space |

Ask @brett to sign off on the #seasonal push, and loop in @dana for the $acme/forecasts numbers.

[^1]: https://scoopdata.io/q3 "ScoopData Q3 report"
[^2]: https://trends.google.com/ice-cream "Google Trends"
[^3]: https://marketbasket.io/flavors "Market Basket"
`,

  docs: `## Ship a status badge

{% stepper %}
{% step %}
### Install

{% command %}npm install @brett_lamy/docstream react{% endcommand %}
{% endstep %}
{% step %}
### Render it

The badges below are a real folder demo — the \`{% demo %}\` tag streams in as one line and resolves through the host's resolver.

{% demo src="demos/badges" %}
{% endstep %}
{% endstepper %}

{% tabs %}
{% tab title="TypeScript" %}
${F}ts
export type Tone = "green" | "amber" | "red"
${F}
{% endtab %}
{% tab title="JavaScript" %}
${F}js
export const TONES = ["green", "amber", "red"]
${F}
{% endtab %}
{% endtabs %}

<details>
<summary>Why does nothing flicker?</summary>

Unclosed blocks swallow the rest of the buffer as their body, so a block is never re-parsed as a paragraph and back.

</details>
`,

  code: `## Streaming a code-heavy answer

A fence that hasn't closed yet still renders as code, line by line:

${F}tsx title="useStream.ts"
import { useEffect, useState } from "react"

export function useStream(url: string) {
  const [text, setText] = useState("")
  useEffect(() => {
    const source = new EventSource(url)
    source.onmessage = (event) => setText((t) => t + event.data)
    return () => source.close()
  }, [url])
  return text
}
${F}

${F}sh
curl -N https://api.example.com/v1/answer?q=flavors
${F}

Block math streams too — the total arrival time for n chunks at a fixed interval:

$$
T = n \\cdot \\Delta t
$$
`,
}

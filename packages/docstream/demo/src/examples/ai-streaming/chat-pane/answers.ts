/* Canned "model" answers. Each is ordinary docstream Markdown. */
const F = "```"

export interface Answer {
  prompt: string
  markdown: string
}

export const ANSWERS: Answer[] = [
  {
    prompt: "Which flavors are trending?",
    markdown: `**Pistachio** leads: up 18% quarter over quarter [^1], peaking on weekend afternoons [^2].

| Flavor | QoQ |
| --- | --- |
| Pistachio | +18% |
| Mango sorbet | +9% |
| Rocky Road | −6% |

{% hint style="success" %}
Recommendation: feature pistachio in the #seasonal campaign. @brett owns the rollout.
{% endhint %}

[^1]: https://scoopdata.io/q3 "ScoopData Q3 report"
[^2]: https://trends.google.com/ice-cream "Google Trends"
`,
  },
  {
    prompt: "How do I stream into docstream?",
    markdown: `Keep appending chunks to one string and re-render — the parser tolerates unclosed blocks.

{% stepper %}
{% step %}
### Accumulate the text

${F}tsx title="Answer.tsx"
const [md, setMd] = useState("")
for await (const chunk of stream) setMd((m) => m + chunk)
${F}
{% endstep %}
{% step %}
### Render it

${F}tsx title="Answer.tsx"
<GitbookStreamdown markdown={md} isStreaming={!done} />
${F}
{% endstep %}
{% endstepper %}

Ask #docstream questions in $blamy/docstream.
`,
  },
  {
    prompt: "Show me a live component",
    markdown: `Here is the status-badge component from the docs, resolved by the host and rendered in the answer:

{% demo src="demos/badges" %}

Switch its variant in the header — the answer stays interactive after the stream ends.
`,
  },
]

export const FALLBACK = (question: string) => `I only know three canned answers in this demo, but here is how I'd format a reply to *${question.replace(/[*_`[\]]/g, "")}*:

{% hint style="info" %}
Lead with the answer, cite sources with footnotes [^1], and use docstream blocks only where they help.
{% endhint %}

[^1]: https://blamy.github.io/docstream/ "docstream docs"
`

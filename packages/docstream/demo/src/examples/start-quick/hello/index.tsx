import { MarkdownContent } from "@brett_lamy/docstream"

// The whole quick start, step 3: a markdown string in, a docs page out.
const page = `## Deploy checklist

{% hint style="warning" %}
Production deploys freeze at **17:00 UTC** on Fridays.
{% endhint %}

{% command %}npm run deploy -- --env=staging{% endcommand %}

- [x] Tests green on \`main\`
- [~] Staging smoke test
- [ ] Announce in #releases
`

export default function Hello() {
  return <MarkdownContent markdown={page} />
}

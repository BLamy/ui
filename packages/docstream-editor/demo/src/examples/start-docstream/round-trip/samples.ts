// Markdown that a naive editor would "normalize" — and that comes back from this one untouched.
export const SAMPLES: Record<string, string> = {
  "Emphasis spellings": `***Both*** marks, __bold__ with underscores, _italic_ too,
and an escaped snake\\_case word.

A link inside bold: **[docs](https://blamy.github.io/ui/#/docstream)**, and bold inside a link: [**docs**](https://blamy.github.io/ui/#/docstream).
`,
  "List markers": `* Star bullets
* stay stars

1) Parenthesis delimiters
2) stay parentheses

- [~] In progress
- [b] Blocked
`,
  "Links and definitions": `Read the [renderer docs][docstream], or <https://github.com/BLamy/ui/tree/main/packages/docstream-editor>.

[docstream]: https://blamy.github.io/ui/#/docstream "docstream"
`,
  "GitBook blocks": `{% hint style="warning" %}
Production deploys freeze at **17:00 UTC** on Fridays.
{% endhint %}

{% tabs title="Install" sync="pm" %}
{% tab title="npm" %}
{% command pnpm="pnpm add -D vitest" %}npm install --save-dev vitest{% endcommand %}
{% endtab %}
{% endtabs %}
`,
  "Citations and chips": `Pistachio is up 18% [^1], says @dana in #seasonal; see $BLamy/docstream.

[^1]: https://scoopdata.io/q3 "ScoopData Q3 report"
`,
  "HTML and unknown tags": `<figure><img src="https://placehold.co/320x80" alt="Banner"><figcaption><p>Kept as written</p></figcaption></figure>

{% some-future-tag foo="bar" %}
`,
}

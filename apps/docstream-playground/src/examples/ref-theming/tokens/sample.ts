// The document every theme renders: a little of each tokenized surface.
export const sample = `### Release 2.4

{% hint style="info" %}
Hints use the semantic palette: \`--gb-info\`, \`--gb-info-border\`, \`--gb-info-bg\`.
{% endhint %}

{% hint style="warning" %}
The \`legacy\` flag is removed in **3.0**.
{% endhint %}

{% tabs %}
{% tab title="TypeScript" %}
\`\`\`ts title="client.ts"
export async function connect(url: string) {
  const socket = new WebSocket(url) // panels, borders and code tokens are all themed
  return socket
}
\`\`\`
{% endtab %}
{% tab title="Shell" %}
\`\`\`sh
curl -X POST https://api.example.com/v2/connect
\`\`\`
{% endtab %}
{% endtabs %}

{% command %}npm install @acme/client@2.4{% endcommand %}

| Token | Drives |
| --- | --- |
| \`--gb-panel\` | Cards, tab sets, code headers |
| \`--gb-primary\` | Active tabs, links, focus |

\`\`\`mermaid
graph LR
  A[connect] --> B{auth?}
  B -->|yes| C[stream]
  B -->|no| D[retry]
\`\`\`
`

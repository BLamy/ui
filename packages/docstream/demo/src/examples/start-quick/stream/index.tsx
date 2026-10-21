import { useEffect, useState } from "react"
import { GitbookStreamdown } from "@brett_lamy/docstream"

// A canned "model answer". It streams in a few characters at a time, so every block —
// the hint, the fence, the table, the citations — is seen half-finished on the way.
const ANSWER = `Yes — move the job to a **queue** and acknowledge the webhook right away [^1].

{% hint style="info" %}
Webhook senders retry on timeouts, so a slow handler causes duplicate deliveries.
{% endhint %}

\`\`\`ts title="webhook.ts"
export async function POST(request: Request) {
  const event = await request.json()
  await queue.send("process-event", event) // returns in milliseconds
  return new Response(null, { status: 202 })
}
\`\`\`

| Approach | p95 response | Duplicates |
| --- | --- | --- |
| Inline processing | 4.2 s | Frequent |
| Queue + 202 | 38 ms | None |

Ask @dana about the #billing retry policy before rolling it out [^2].

[^1]: https://example.com/webhooks/best-practices "Webhook best practices"
[^2]: https://example.com/runbooks/billing "Billing runbook"
`

const SPEEDS = { slow: 2, normal: 6, fast: 18 } as const

export default function StreamingAnswer({ variant = "normal" }: { variant?: string }) {
  const step = SPEEDS[variant as keyof typeof SPEEDS] ?? SPEEDS.normal
  const [length, setLength] = useState(0)
  const [run, setRun] = useState(0)
  const done = length >= ANSWER.length

  useEffect(() => {
    setLength(0)
    const timer = setInterval(() => {
      setLength((n) => {
        if (n >= ANSWER.length) {
          clearInterval(timer)
          return n
        }
        return Math.min(ANSWER.length, n + step)
      })
    }, 24)
    return () => clearInterval(timer)
  }, [run, step])

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
        <button type="button" onClick={() => setRun((r) => r + 1)}>
          {done ? "Replay" : "Restart"}
        </button>
        <code>isStreaming={String(!done)}</code>
        <span style={{ opacity: 0.7 }}>
          {length} / {ANSWER.length} chars
        </span>
      </div>
      <GitbookStreamdown markdown={ANSWER.slice(0, length)} isStreaming={!done} />
    </div>
  )
}

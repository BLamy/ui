import type { Message } from "../messages"

export function MessageView({ message, onBack }: { message: Message | null; onBack: () => void }) {
  if (!message) return <section className="inbox-view inbox-empty">Select a message</section>
  return (
    <section className="inbox-view">
      <button type="button" className="inbox-back" onClick={onBack}>← Inbox</button>
      <h3>{message.subject}</h3>
      <p className="inbox-meta">{message.from} · {message.time}</p>
      <p>{message.preview}</p>
      <p>— sent from the docstream demo inbox</p>
    </section>
  )
}

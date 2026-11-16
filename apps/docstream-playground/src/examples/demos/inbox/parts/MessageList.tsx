import type { Message } from "../messages"

export function MessageList({ messages, activeId, onOpen }: {
  messages: Message[]
  activeId: number | null
  onOpen: (id: number) => void
}) {
  return (
    <nav className="inbox-list" aria-label="Messages">
      <div className="inbox-list-head">Inbox <span>{messages.filter((m) => m.unread).length} new</span></div>
      {messages.map((m) => (
        <button key={m.id} type="button" className="inbox-item" aria-current={m.id === activeId || undefined} onClick={() => onOpen(m.id)}>
          <span className="inbox-item-top">
            <strong>{m.from}</strong>
            <time>{m.time}</time>
          </span>
          <span className="inbox-item-subject">{m.unread ? <i aria-label="unread" /> : null}{m.subject}</span>
          <span className="inbox-item-preview">{m.preview}</span>
        </button>
      ))}
    </nav>
  )
}

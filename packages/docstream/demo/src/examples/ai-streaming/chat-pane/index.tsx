import { useContext, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { DocstreamRefContext, GitbookStreamdown, type ReferenceNode } from "@brett_lamy/docstream"
import { ANSWERS, FALLBACK } from "./answers"
import "./chat-pane.css"

interface Message {
  id: number
  role: "user" | "assistant"
  text: string
  /** The full answer; `text` grows toward it while streaming. */
  target?: string
}

let nextId = 1

export default function ChatPane() {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const [clicked, setClicked] = useState<ReferenceNode | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  const streamingId = messages.find((m) => m.role === "assistant" && m.target !== undefined && m.text.length < m.target.length)?.id

  // The "network": grow the streaming message a few characters per tick.
  useEffect(() => {
    if (streamingId === undefined) return
    const timer = setInterval(() => {
      setMessages((list) =>
        list.map((m) => (m.id === streamingId && m.target ? { ...m, text: m.target.slice(0, m.text.length + 3 + Math.floor(Math.random() * 6)) } : m)),
      )
    }, 35)
    return () => clearInterval(timer)
  }, [streamingId])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages])

  const ask = (question: string) => {
    const text = question.trim()
    if (!text || streamingId !== undefined) return
    const answer = ANSWERS.find((a) => a.prompt.toLowerCase() === text.toLowerCase())?.markdown ?? FALLBACK(text)
    setMessages((list) => [...list, { id: nextId++, role: "user", text }, { id: nextId++, role: "assistant", text: "", target: answer }])
    setDraft("")
  }
  const stop = () => setMessages((list) => list.map((m) => (m.id === streamingId ? { ...m, target: m.text } : m)))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    ask(draft)
  }

  // Keep the host's citation previews; add our own click handler on top.
  const outer = useContext(DocstreamRefContext)
  const refs = useMemo(() => ({ ...outer, onReferenceClick: (ref: ReferenceNode) => setClicked(ref) }), [outer])

  return (
    <DocstreamRefContext.Provider value={refs}>
      <div className="chat">
        <div className="chat-log" ref={scroller}>
          {messages.length === 0 ? <p className="chat-empty">Pick a prompt below — the answer streams in through GitbookStreamdown.</p> : null}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="chat-user">{m.text}</div>
            ) : (
              <div key={m.id} className="chat-assistant">
                <GitbookStreamdown
                  markdown={m.text}
                  isStreaming={m.id === streamingId}
                  // Copy page is hidden while streaming, then copies just this answer.
                  pageActions={{ actions: ["copy"] }}
                  documentProperties={false}
                />
              </div>
            ),
          )}
        </div>
        {clicked ? (
          <div className="chat-ref" role="status">
            onReferenceClick → <code>{clicked.kind}</code> <strong>{clicked.id}</strong>
            {clicked.url ? <> · {clicked.url}</> : null}
            <button type="button" onClick={() => setClicked(null)} aria-label="Dismiss">×</button>
          </div>
        ) : null}
        <div className="chat-prompts">
          {ANSWERS.map((a) => (
            <button key={a.prompt} type="button" disabled={streamingId !== undefined} onClick={() => ask(a.prompt)}>
              {a.prompt}
            </button>
          ))}
        </div>
        <form className="chat-composer" onSubmit={submit}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask something…" aria-label="Message" />
          {streamingId !== undefined ? (
            <button type="button" onClick={stop}>Stop</button>
          ) : (
            <button type="submit" disabled={!draft.trim()}>Send</button>
          )}
        </form>
      </div>
    </DocstreamRefContext.Provider>
  )
}

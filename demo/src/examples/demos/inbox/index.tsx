import { useState } from "react"
import { MessageList } from "./parts/MessageList"
import { MessageView } from "./parts/MessageView"
import { MESSAGES } from "./messages"
import "./inbox.css"

export default function Inbox() {
  const [openId, setOpenId] = useState<number | null>(MESSAGES[0].id)
  const open = MESSAGES.find((m) => m.id === openId) ?? null
  return (
    <div className="inbox" data-open={open ? "" : undefined}>
      <MessageList messages={MESSAGES} activeId={openId} onOpen={setOpenId} />
      <MessageView message={open} onBack={() => setOpenId(null)} />
    </div>
  )
}

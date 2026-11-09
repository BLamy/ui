export interface Message {
  id: number
  from: string
  subject: string
  preview: string
  time: string
  unread?: boolean
}

export const MESSAGES: Message[] = [
  { id: 1, from: "Ada Lovelace", subject: "Engine notes", preview: "I've annotated the second table — the loop is the interesting part.", time: "9:41", unread: true },
  { id: 2, from: "Grace Hopper", subject: "Found a bug", preview: "Literally. Taped it into the log book for posterity.", time: "8:12", unread: true },
  { id: 3, from: "Alan Turing", subject: "Re: the imitation game", preview: "Could a reader tell which reply came from the machine?", time: "Yesterday" },
  { id: 4, from: "Katherine Johnson", subject: "Trajectory check", preview: "Numbers agree to the eighth decimal. Go for launch.", time: "Mon" },
]

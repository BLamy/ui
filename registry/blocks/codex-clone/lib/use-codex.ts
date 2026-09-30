import { useEffect, useRef, useState } from 'react';
import { CHATS, DOCS, REPLIES, type Chat, type ChatItem, type Doc } from './data';

/** What a chat has open beside it: the documents in its document pane and the one showing. */
export interface ChatWorkspace {
  docs: string[];
  doc: string | null;
}

const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const stamp = () => new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + clock();

/**
 * Chats, documents, and — per chat — the document pane's workspace, plus a fake dot that streams canned replies.
 * Each chat keeps its own document tabs and the one showing, so picking another chat brings back its documents;
 * a reply that lands while you are elsewhere marks that chat unread. Replace `send` with a call to your backend.
 */
export function useCodex(initial = 'dot') {
  const [chats, setChats] = useState<Chat[]>(CHATS);
  const [docs, setDocs] = useState<Record<string, Doc>>(() => Object.fromEntries(DOCS.map((d) => [d.id, d])));
  const [spaces, setSpaces] = useState<Record<string, ChatWorkspace>>(() =>
    Object.fromEntries(CHATS.map((c) => [c.id, { docs: c.docs, doc: c.docs[0] ?? null }])),
  );
  const [currentId, setCurrentId] = useState(initial);
  const current = chats.find((c) => c.id === currentId) ?? chats[0];
  const currentRef = useRef(current.id);
  currentRef.current = current.id;

  // Scroll offset of each document as it was left, per chat. Read on mount, written on scroll: never rendered.
  const scrolls = useRef<Record<string, number>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const turn = useRef(0);
  useEffect(() => {
    const running = timers.current;
    return () => running.forEach((t) => clearInterval(t));
  }, []);

  const patchChat = (id: string, fn: (c: Chat) => Chat) => setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  const patchItem = (id: string, itemId: string, patch: Partial<Extract<ChatItem, { kind: 'message' }>>) =>
    patchChat(id, (c) => ({ ...c, items: c.items.map((i) => (i.id === itemId && i.kind === 'message' ? { ...i, ...patch } : i)) }));
  const openIn = (chatId: string, docId: string) =>
    setSpaces((all) => {
      const w = all[chatId] ?? { docs: [], doc: null };
      return { ...all, [chatId]: { docs: w.docs.includes(docId) ? w.docs : [...w.docs, docId], doc: docId } };
    });

  const select = (id: string) => {
    setCurrentId(id);
    patchChat(id, (c) => (c.unread ? { ...c, unread: 0 } : c));
  };

  /** A chat with nothing in it yet: reuse the one already waiting, else start another. */
  const newChat = () => {
    const blank = chats.find((c) => c.kind === 'dot' && c.items.length === 0);
    if (blank) return select(blank.id);
    const id = 'c' + Date.now();
    setChats((cs) => [{ id, kind: 'dot', title: 'New chat', unread: 0, items: [], docs: [] }, ...cs]);
    setSpaces((all) => ({ ...all, [id]: { docs: [], doc: null } }));
    setCurrentId(id);
  };

  const send = (text: string) => {
    const said = text.trim();
    if (!said) return;
    const chat = current;
    const id = chat.id;
    const now = Date.now();
    const mid = 'a' + now;
    const first = chat.items.length === 0;
    patchChat(id, (c) => ({
      ...c,
      title: c.title === 'New chat' ? (said.length > 32 ? said.slice(0, 30) + '…' : said) : c.title,
      items: [
        ...c.items,
        ...(first ? [{ id: 'time' + now, kind: 'time' as const, label: stamp() }] : []),
        { id: 'u' + now, kind: 'message' as const, role: 'user' as const, text: said },
        { id: mid, kind: 'message' as const, role: 'dot' as const, text: '', live: true },
      ],
    }));
    const words = REPLIES[turn.current++ % REPLIES.length].split(' ');
    let i = 0;
    clearInterval(timers.current.get(id));
    timers.current.set(
      id,
      setInterval(() => {
        i += 2 + Math.floor(Math.random() * 4);
        if (i < words.length) return patchItem(id, mid, { text: words.slice(0, i).join(' ') });
        clearInterval(timers.current.get(id));
        timers.current.delete(id);
        // A chat with no document yet gets one from dot's first reply.
        let doc: string | undefined;
        if (chat.kind === 'dot' && (spaces[id]?.docs.length ?? 0) === 0) {
          doc = 'd' + now;
          const title = said.length > 40 ? said.slice(0, 38) + '…' : said;
          setDocs((all) => ({
            ...all,
            [doc as string]: { id: doc as string, emoji: '📝', title, body: `Notes from this chat, kept up to date as we go.\n\n## Summary\n\n- ${said}\n\n## Next steps\n\n- [ ] Confirm the cause\n- [ ] Write down what would prove it fixed\n` },
          }));
          openIn(id, doc);
        }
        patchItem(id, mid, { text: words.join(' '), live: false, doc });
        patchItem(id, 'u' + now, { read: 'Read ' + clock() });
        if (currentRef.current !== id) patchChat(id, (c) => ({ ...c, unread: c.unread + 1 }));
      }, 90),
    );
  };

  const workspace = spaces[current.id] ?? { docs: [], doc: null };
  return {
    chats,
    current,
    select,
    newChat,
    send,
    streaming: current.items.some((i) => i.kind === 'message' && i.live),
    /** chats with replies waiting: the sidebar's Priority */
    priority: chats.filter((c) => c.unread > 0),
    /** the current chat's document pane */
    workspace: {
      docs: workspace.docs.map((d) => docs[d]).filter(Boolean),
      doc: workspace.doc ? (docs[workspace.doc] ?? null) : null,
      open: (docId: string) => openIn(current.id, docId),
      /** where this chat left `docId` scrolled to */
      scrollOf: (docId: string) => scrolls.current[`${current.id}:${docId}`] ?? 0,
      saveScroll: (docId: string, top: number) => {
        scrolls.current[`${current.id}:${docId}`] = top;
      },
    },
    doc: (id: string) => docs[id],
    editDoc: (id: string, patch: Partial<Pick<Doc, 'title' | 'body'>>) => setDocs((all) => ({ ...all, [id]: { ...all[id], ...patch } })),
  };
}
export type CodexState = ReturnType<typeof useCodex>;

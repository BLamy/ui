/* Mail state: messages, the open mailbox and message, search, the unread filter, edit-mode selection and the
   compose draft — one hook shared by every column, so crossing a width class keeps
   everything where it was. Every action plays its haptic here, next to the change it confirms. */
import { useMemo, useState } from 'react';
import { Haptics } from '@brett_lamy/ui';
import { MAILBOXES, MESSAGES, ME, NOW, preview, type Mailbox, type Message, type Person } from './data';

export interface Draft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  /** Replying to this message. */
  replyTo?: string;
}

/** Messages written in this session, stamped a minute apart after NOW so they sort to the top. */
let written = 0;

const matches = (box: Mailbox, m: Message) => (box.match ? box.match(m) : m.box === box.id);

export function useMail({ mailbox: initialBox = 'inbox', message: initialMessage = null as string | null, draft: initialDraft = null as Draft | null } = {}) {
  const [messages, setMessages] = useState<Message[]>(() => MESSAGES.map((m) => (m.id === initialMessage ? { ...m, unread: false } : m)));
  const [boxId, setBoxId] = useState(initialBox);
  const [selectedId, setSelectedId] = useState<string | null>(initialMessage);
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<Draft | null>(initialDraft);

  const box = MAILBOXES.find((b) => b.id === boxId) ?? MAILBOXES[0];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages
      .filter((m) => matches(box, m))
      .filter((m) => !unreadOnly || m.unread)
      .filter((m) => !q || `${m.from.name} ${m.subject} ${preview(m)}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [messages, box, query, unreadOnly]);
  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const count = (b: Mailbox) => {
    if (b.count === 'none') return 0;
    const inBox = messages.filter((m) => matches(b, m));
    return b.count === 'all' ? inBox.length : inBox.filter((m) => m.unread).length;
  };

  const patch = (ids: string[], fn: (m: Message) => Partial<Message>) =>
    setMessages((all) => all.map((m) => (ids.includes(m.id) ? { ...m, ...fn(m) } : m)));

  /** The message after (or before) `id` in the visible list — where the selection lands when `id` leaves. */
  const neighbour = (ids: string[]) => {
    const rest = list.filter((m) => !ids.includes(m.id));
    const i = list.findIndex((m) => m.id === selectedId);
    return rest[Math.min(Math.max(i, 0), rest.length - 1)]?.id ?? null;
  };

  const moveTo = (ids: string[], target: string) => {
    if (!ids.length) return;
    if (selectedId && ids.includes(selectedId)) setSelectedId(neighbour(ids));
    // Trashing from the Trash deletes for good.
    if (target === 'trash' && ids.every((id) => messages.find((m) => m.id === id)?.box === 'trash'))
      setMessages((all) => all.filter((m) => !ids.includes(m.id)));
    else patch(ids, () => ({ box: target, unread: false }));
    setChecked(new Set());
    Haptics.impact(target === 'trash' ? 'medium' : 'light');
  };

  const open = (id: string | null) => {
    setSelectedId(id);
    if (id) patch([id], () => ({ unread: false }));
  };

  const people = (s: string): Person[] =>
    s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => ({ name: x.split('@')[0].replace(/^./, (c) => c.toUpperCase()), email: x }));

  return {
    messages, list, box, boxId, selected, selectedId, query, unreadOnly, editing, checked, draft, count,
    setQuery,
    openBox(id: string) {
      if (id === boxId) return;
      setBoxId(id); setQuery(''); setEditing(false); setChecked(new Set());
      Haptics.selection();
    },
    open,
    /** Step through the list (the detail toolbar's up / down chevrons). */
    step(dir: 1 | -1) {
      const i = list.findIndex((m) => m.id === selectedId);
      const next = list[i + dir];
      if (next) { open(next.id); Haptics.selection(); }
    },
    toggleUnreadFilter() { setUnreadOnly((v) => !v); Haptics.selection(); },
    toggleFlag(id: string) { patch([id], (m) => ({ flagged: !m.flagged })); Haptics.impact('light'); },
    toggleRead(id: string) { patch([id], (m) => ({ unread: !m.unread })); Haptics.impact('light'); },
    archive: (ids: string[]) => moveTo(ids, 'archive'),
    trash: (ids: string[]) => moveTo(ids, 'trash'),
    moveTo,
    setEditing(on: boolean) { setEditing(on); setChecked(new Set()); Haptics.selection(); },
    toggleChecked(id: string) {
      setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
      Haptics.selection();
    },
    checkAll() { setChecked((s) => (s.size === list.length ? new Set() : new Set(list.map((m) => m.id)))); Haptics.selection(); },
    markChecked(unread: boolean) { patch([...checked], () => ({ unread })); setChecked(new Set()); setEditing(false); Haptics.impact('light'); },

    compose(kind: 'new' | 'reply' | 'replyAll' | 'forward' = 'new', m: Message | null = null) {
      Haptics.impact('light');
      if (!m || kind === 'new') { setDraft({ to: '', cc: '', subject: '', body: '' }); return; }
      const quoted = `\u00a0\n\n> On ${m.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${m.from.name} wrote:\n>\n${m.body.filter((l) => !l.startsWith('>')).map((l) => `> ${l}`).join('\n>\n')}`;
      const prefix = kind === 'forward' ? 'Fwd: ' : 'Re: ';
      setDraft({
        to: kind === 'forward' ? '' : m.from.email,
        cc: kind === 'replyAll' ? [...m.to, ...(m.cc ?? [])].filter((x) => x.email !== ME.email).map((x) => x.email).join(', ') : '',
        subject: m.subject.startsWith(prefix) ? m.subject : prefix + m.subject.replace(/^(Re|Fwd): /, ''),
        body: quoted,
        replyTo: m.id,
      });
    },
    editDraft: (d: Partial<Draft>) => setDraft((cur) => (cur ? { ...cur, ...d } : cur)),
    /** Close the compose sheet: send it, save it to Drafts, or throw it away. */
    closeDraft(action: 'send' | 'save' | 'discard') {
      const d = draft;
      setDraft(null);
      if (!d || action === 'discard') return;
      const blank = !d.to.trim() && !d.subject.trim() && !d.body.trim();
      if (action === 'save' && blank) return;
      const body = d.body.split('\n').map((l) => l.replace(/^>\s*/, '> ').trim()).filter((l) => l && l !== '>');
      const msg: Message = {
        id: `n${Date.now()}-${written}`, box: action === 'send' ? 'sent' : 'drafts', from: ME, to: people(d.to), cc: people(d.cc),
        subject: d.subject || '(No Subject)', date: new Date(NOW.getTime() + 60_000 * ++written), body,
      };
      setMessages((all) => [msg, ...all]);
      if (action === 'send') Haptics.notification('success');
      else Haptics.impact('light');
    },
  };
}

export type MailState = ReturnType<typeof useMail>;

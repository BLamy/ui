/* A message: sender header with avatar, subject, body with quoted text drawn as Mail's tinted quote bar,
   attachment tiles, and the earlier messages of the conversation as cards that expand in place. */
import { useState, type ReactNode } from 'react';
import { AnimatedHeight, Avatar, Chevron, Icon, cn } from '@brett_lamy/ui';
import { ME, initials, longTime, relativeTime, type Attachment, type Message, type Person, type ThreadEntry } from './data';

const names = (xs: Person[]) => xs.map((x) => (x.email === ME.email ? 'Me' : x.name)).join(', ');

function Body({ lines }: { lines: string[] }) {
  // Consecutive "> " lines form one quote block.
  const blocks: { quote: boolean; lines: string[] }[] = [];
  for (const l of lines) {
    const quote = l.startsWith('>');
    const last = blocks[blocks.length - 1];
    const text = quote ? l.replace(/^>\s?/, '') : l;
    if (last && last.quote && quote) last.lines.push(text);
    else blocks.push({ quote, lines: [text] });
  }
  return (
    <div className="flex flex-col gap-3.5 text-[16px] leading-[1.55]">
      {blocks.map((b, i) => b.quote ? (
        <blockquote key={i} className="m-0 flex flex-col gap-2 py-0.5 pr-0 pl-3.5 text-[15px] text-muted-foreground shadow-[inset_3px_0_0_var(--primary)]">
          {b.lines.filter(Boolean).map((l, j) => <p key={j} className="m-0">{l}</p>)}
        </blockquote>
      ) : <p key={i} className="m-0">{b.lines[0]}</p>)}
    </div>
  );
}

/** File-type tile colors (fixed, like Mail's document icons). */
const ATTACHMENT_TONE: Record<Attachment['kind'], string> = { pdf: '#FF3B30', image: '#34C759', zip: '#8E8E93', doc: '#0A84FF' };

function AttachmentTile({ a }: { a: Attachment }) {
  return (
    <button type="button"
      className="bl-btn flex min-w-0 cursor-pointer items-center gap-2.5 rounded-[12px] border-0 bg-secondary px-3 py-2.5 text-left [font-family:inherit] text-foreground transition-colors hover:bg-secondary-strong">
      <span className="grid size-9 shrink-0 place-items-center rounded-[8px] text-white" style={{ background: ATTACHMENT_TONE[a.kind] }}>
        <Icon name={a.kind === 'image' ? 'photo' : a.kind === 'zip' ? 'archivebox' : 'doc'} size={20} sw={1.9} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium">{a.name}</span>
        <span className="block text-[12.5px] text-muted-foreground">{a.size}</span>
      </span>
    </button>
  );
}

function Header({ from, to, cc, date, trailing }: { from: Person; to: Person[]; cc?: Person[]; date: Date; trailing?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar c={initials(from)} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{from.name}</span>
          <span className="shrink-0 text-[13px] text-muted-foreground">{relativeTime(date)}</span>
          {trailing}
        </div>
        <div className="truncate text-[13.5px] text-muted-foreground">To: <span className="text-foreground">{names(to)}</span></div>
        {cc?.length ? <div className="truncate text-[13.5px] text-muted-foreground">Cc: <span className="text-foreground">{names(cc)}</span></div> : null}
      </div>
    </div>
  );
}

function EarlierMessage({ e }: { e: ThreadEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[14px] bg-card shadow-[0_0_0_1px_var(--border)]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="bl-btn flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3 text-left [font-family:inherit] text-foreground">
        <Avatar c={initials(e.from)} size={30} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{e.from.email === ME.email ? 'Me' : e.from.name}</span>
            <span className="shrink-0 text-[13px] text-muted-foreground">{relativeTime(e.date)}</span>
          </span>
          <span className={cn('block truncate text-[14px] text-muted-foreground transition-opacity duration-200', open && 'opacity-0')}>{e.body[0]}</span>
        </span>
        <Chevron direction={open ? 'down' : 'right'} size={14} className="text-tertiary-foreground" />
      </button>
      <AnimatedHeight>
        {open ? <div className="px-4 pt-0 pb-4 pl-[58px]"><Body lines={e.body} /></div> : null}
      </AnimatedHeight>
    </div>
  );
}

export function MessageView({ m }: { m: Message }) {
  return (
    <article className="mx-auto w-full max-w-[760px] px-6 pt-5 pb-24 select-text" aria-label={m.subject}>
      <Header from={m.from} to={m.to} cc={m.cc} date={m.date} />
      <h1 className="mt-4 mb-1 flex items-start gap-2 text-[22px] leading-[1.25] font-bold tracking-[-.3px]">
        <span className="min-w-0 flex-1">{m.subject}</span>
        {m.flagged ? <Icon name="flag-fill" size={18} weight="medium" className="mt-1 text-warning" /> : null}
      </h1>
      <div className="mb-5 text-[13px] text-muted-foreground">{longTime(m.date)}</div>
      <Body lines={m.body} />
      {m.attachments?.length ? (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
          {m.attachments.map((a) => <AttachmentTile key={a.name} a={a} />)}
        </div>
      ) : null}
      {m.thread?.length ? (
        <section className="mt-8" aria-label="Earlier messages">
          <div className="mb-2 text-[13px] font-semibold text-muted-foreground">{m.thread.length} Earlier Messages</div>
          <div className="flex flex-col gap-2">{m.thread.map((e, i) => <EarlierMessage key={i} e={e} />)}</div>
        </section>
      ) : null}
    </article>
  );
}

export function NoMessage({ count }: { count: number }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div>
        <div className="mb-3 grid place-items-center text-tertiary-foreground"><Icon name="envelope" size={56} sw={1.1} /></div>
        <div className="text-[19px] font-semibold text-muted-foreground">No Message Selected</div>
        <div className="mt-1 text-[14px] text-tertiary-foreground">{count ? `${count} message${count === 1 ? '' : 's'}` : 'This mailbox is empty'}</div>
      </div>
    </div>
  );
}

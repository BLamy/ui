/* The compose sheet: Cancel · subject · Send, the To / Cc / Subject fields and a rich-text body (MarkdownEditor,
   so replies carry the quoted message as a real quote block). A card sheet on the phone, a centered form sheet
   on wider screens. Cancelling keeps anything you wrote in Drafts. */
import { useRef, type ReactNode } from 'react';
import { Button, MarkdownEditor, SheetContent, TextMorph, cn } from '@brett_lamy/ui';
import { ME } from './data';
import { G } from './glyphs';
import type { MailState } from './use-mail';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-h-[46px] items-center gap-2 px-4 shadow-[inset_0_-1px_0_var(--bl-sep)]">
      <span className="shrink-0 text-[16px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const input = 'min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-[16px] text-foreground outline-none select-text placeholder:text-bl-label3';

export function ComposeSheet({ mail, wide }: { mail: MailState; wide: boolean }) {
  // The sheet keeps showing the last draft while it slides away.
  const last = useRef(mail.draft);
  if (mail.draft) last.current = mail.draft;
  const d = mail.draft ?? last.current;
  return (
    <SheetContent aria-label="New message" isOpen={!!mail.draft} onOpenChange={(open) => { if (!open) mail.closeDraft('save'); }} grabber={!wide}
      className={cn(wide
        ? 'inset-x-[max(24px,calc(50%-350px))] top-[max(24px,5%)] bottom-[max(24px,5%)] max-h-none rounded-[16px] pb-0'
        : 'top-[40px] max-h-none pb-0')}>
      {d ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-[52px] shrink-0 items-center gap-2 px-2">
            <Button variant="link" className="px-2 text-[17px] font-normal" onPress={() => mail.closeDraft('save')}>Cancel</Button>
            <div className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold"><TextMorph>{d.subject.trim() || 'New Message'}</TextMorph></div>
            <Button variant="ghost" size="icon" aria-label="Send" isDisabled={!d.to.trim()} onPress={() => mail.closeDraft('send')}
              className="text-primary data-disabled:text-bl-label3 data-disabled:opacity-100">
              <G name="send" size={32} />
            </Button>
          </div>
          <div className="bl-scroll min-h-0 flex-1 overflow-y-auto">
            <Field label="To:">
              <input className={input} value={d.to} autoFocus={!d.to} aria-label="To" inputMode="email"
                onChange={(e) => mail.editDraft({ to: e.target.value })} />
            </Field>
            <Field label={d.cc ? 'Cc:' : 'Cc/Bcc, From:'}>
              {d.cc
                ? <input className={input} value={d.cc} aria-label="Cc" onChange={(e) => mail.editDraft({ cc: e.target.value })} />
                : <span className="min-w-0 flex-1 truncate text-[16px] text-foreground">{ME.email}</span>}
            </Field>
            <Field label="Subject:">
              <input className={input} value={d.subject} aria-label="Subject" onChange={(e) => mail.editDraft({ subject: e.target.value })} />
            </Field>
            <MarkdownEditor key={d.replyTo ?? 'new'} variant="ghost" aria-label="Message body" defaultValue={d.body}
              autoFocus={!!d.to} slashMenu={false} minHeight={260} placeholder=" "
              onValueChange={(body) => mail.editDraft({ body })} className="px-4 pt-3 pb-8 text-[16px] [&_blockquote]:border-l-primary!" />
          </div>
        </div>
      ) : null}
    </SheetContent>
  );
}

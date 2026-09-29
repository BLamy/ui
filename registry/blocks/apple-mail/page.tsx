/* Apple Mail clone — mailboxes, message list and message, with swipe actions, edit mode, search, an unread
   filter, threads, and a compose sheet. One SplitView at every size: three tiled columns at regular width
   (≥1024), list · message with the mailboxes floating over them on an iPad, and a stack with large titles and
   back buttons on an iPhone. */
import { useState } from 'react';
import { AppearanceProvider, BLProvider, SplitView, useAppearance, type Appearance } from '@brett_lamy/ui';
import { ListColumn, MessageColumn } from './columns';
import { ComposeSheet } from './compose';
import { MailboxesSidebar } from './mailboxes';
import { useMail, type Draft } from './use-mail';

export interface AppleMailProps {
  /** Light or dark. Defaults to the ambient AppearanceProvider, else light. */
  appearance?: Appearance;
  /** Mailbox to open on (e.g. 'inbox', 'flagged', 'unread'). */
  initialMailbox?: string;
  /** Message selected at mount (wide layouts), e.g. 'm2'. */
  initialMessage?: string | null;
  /** Open the compose sheet at mount. */
  initialDraft?: Draft | null;
}

/** Mail's accent: iOS system blue (light #007AFF, dark #0A84FF). */
const MAIL_TINT = { light: '#007AFF', dark: '#0A84FF' } as const;

export default function AppleMail({ appearance, initialMailbox = 'inbox', initialMessage = 'm2', initialDraft = null }: AppleMailProps) {
  const ambient = useAppearance();
  const dark = (appearance ?? ambient) === 'dark';
  const [compact, setCompact] = useState(false);
  const mail = useMail({ mailbox: initialMailbox, message: initialMessage, draft: initialDraft });

  return (
    <AppearanceProvider value={dark ? 'dark' : 'light'}>
      <BLProvider tint={MAIL_TINT[dark ? 'dark' : 'light']} className="bg-background">
        <SplitView aria-label="Mail" onWidthClassChange={(wc) => setCompact(wc === 'compact')}
          selection={{ sidebar: mail.boxId, supplementary: mail.selectedId }}
          onSelectionChange={(sel) => { if (sel.sidebar) mail.openBox(sel.sidebar); }}>
          <MailboxesSidebar mail={mail} />
          <ListColumn mail={mail} />
          <MessageColumn mail={mail} />
        </SplitView>
        <ComposeSheet mail={mail} wide={!compact} />
      </BLProvider>
    </AppearanceProvider>
  );
}

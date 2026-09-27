/* Apple Mail clone — mailboxes, message list and message, with swipe actions, edit mode, search, an unread
   filter, threads, and a compose sheet.
   Regular width (≥1024): three tiled columns. Medium (iPad): list · message, the mailboxes float over them.
   Compact (iPhone): a NavigationStack with large titles. */
import {
  AppearanceProvider, BLProvider, SplitView, useAppearance, useContainerWidth, type Appearance, type SplitViewWidthClass,
} from '@brett_lamy/ui';
import { ListColumn, MessageColumn } from './columns';
import { ComposeSheet } from './compose';
import { MailboxesSidebar } from './mailboxes';
import { PhoneMail } from './phone';
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

export default function AppleMail({ appearance, initialMailbox = 'inbox', initialMessage = 'm2', initialDraft = null }: AppleMailProps) {
  const ambient = useAppearance();
  const dark = (appearance ?? ambient) === 'dark';
  const [ref, width] = useContainerWidth<HTMLDivElement>(1280);
  const widthClass: SplitViewWidthClass = width >= 1024 ? 'regular' : width >= 640 ? 'medium' : 'compact';
  const mail = useMail({ mailbox: initialMailbox, message: initialMessage, draft: initialDraft });

  return (
    <AppearanceProvider value={dark ? 'dark' : 'light'}>
      <BLProvider tint={dark ? '#0A84FF' : '#007AFF'} className="bg-background">
        <div ref={ref} className="relative h-full w-full">
          {widthClass === 'compact' ? <PhoneMail mail={mail} /> : (
            <SplitView aria-label="Mail" widthClass={widthClass}
              selection={{ sidebar: mail.boxId, supplementary: mail.selectedId }}
              onSelectionChange={(sel) => { if (sel.sidebar) mail.openBox(sel.sidebar); }}>
              <MailboxesSidebar mail={mail} />
              <ListColumn mail={mail} />
              <MessageColumn mail={mail} />
            </SplitView>
          )}
          <ComposeSheet mail={mail} wide={widthClass !== 'compact'} />
        </div>
      </BLProvider>
    </AppearanceProvider>
  );
}

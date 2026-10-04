import { Composer, ComposerAddon, ComposerAttach, ComposerAttachments, ComposerCard, ComposerInput, ComposerSend, type ComposerProps } from '@/components/ui/composer/composer';
import { useChatUsers } from './components/chat-users';

export interface MessageComposerProps extends Omit<ComposerProps, 'children' | 'onSubmit'> {
  placeholder?: string;
  autoFocus?: boolean;
  /** channel names the "#" picker offers */
  channels?: string[];
  /** the message as Markdown (`@id` mentions, pasted images inline) */
  onSend: (markdown: string) => void;
}

/** The message field: the core Composer (the Docstream editor, attach and send on one row), with "@" offering the chat's
 *  users and "#" its channels. Enter sends, Shift+Enter breaks the line. */
export function MessageComposer({ placeholder, autoFocus, channels, onSend, ...props }: MessageComposerProps) {
  const users = useChatUsers();
  const references = {
    mentions: Object.entries(users).map(([id, user]) => ({ id, label: user.name, description: user.bot ? 'app' : undefined })),
    ...(channels && { tags: channels }),
  };
  return (
    <Composer
      acceptedFileTypes={['image/*']}
      // Images ride along as Markdown, in place of their `attachment:` chips.
      onSubmit={(markdown, attachments) => onSend(attachments.reduce((md, a) => md.replace(`attachment:${a.id}`, a.src ?? ''), markdown))}
      {...props}
    >
      <ComposerCard>
        <ComposerAttachments />
        <ComposerAddon align="inline-start">
          <ComposerAttach label="Attach images" />
        </ComposerAddon>
        <ComposerInput placeholder={placeholder} autoFocus={autoFocus} references={references} />
        <ComposerAddon align="inline-end">
          <ComposerSend />
        </ComposerAddon>
      </ComposerCard>
    </Composer>
  );
}

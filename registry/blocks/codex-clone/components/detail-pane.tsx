import { SplitViewDetail } from '@brett_lamy/ui';
import type { CodexState } from '../lib/use-codex';
import { DocContent } from './doc-pane';
import { ThreadContent } from './thread-page';

/** The third column: a chat with dot shows its document beside the chat; a project thread fills it with the thread itself. */
export function DetailPane({ codex }: { codex: CodexState }) {
  const thread = codex.current.kind === 'thread';
  return (
    <SplitViewDetail aria-label={thread ? 'Thread' : 'Document'} minWidth={360}>
      {thread ? <ThreadContent codex={codex} /> : <DocContent codex={codex} />}
    </SplitViewDetail>
  );
}

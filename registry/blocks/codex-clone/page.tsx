import { AppearanceProvider, BLProvider, SplitView, useAppearance, type Appearance } from '@brett_lamy/ui';
import { ChatPane } from './components/chat-pane';
import { ChatSidebar } from './components/chat-sidebar';
import { DetailPane } from './components/detail-pane';
import { useCodex } from './lib/use-codex';

export interface CodexCloneProps {
  /** light or dark; defaults to the ambient AppearanceProvider, else dark */
  appearance?: Appearance;
  /** accent for your messages and links */
  tint?: string;
  /** chat open at mount */
  initialChat?: string;
  /**
   * The sidebar with the inbox on (default): Priority for chats with replies waiting, then the rest. Off: Projects —
   * folders of threads — and Recents.
   */
  inbox?: boolean;
}

/** The default accent: a muted slate blue. */
const DEFAULT_TINT = '#6E88B8';

/**
 * Codex clone — chats with dot beside the documents dot keeps for them. An icon rail and chat list, the chat,
 * and a document pane with a section outline in its margin. A project thread (Projects in the sidebar, when the inbox is off) takes over the
 * chat and document columns: a wide transcript with a turn rail in its margin, and the thread's panel. Each chat brings its own documents: picking another
 * switches the pane to that chat's documents, back on the section you left. Three columns on desktop; on a
 * phone the same columns stack — chats, then the chat, then its document.
 */
export default function CodexClone({ appearance, tint = DEFAULT_TINT, initialChat = 'dot', inbox = true }: CodexCloneProps) {
  const ambient = useAppearance();
  const look = appearance ?? (ambient === 'light' ? 'light' : 'dark');
  const codex = useCodex(initialChat);
  return (
    <AppearanceProvider value={look}>
      <BLProvider tint={tint} className="bg-background">
        <SplitView aria-label="Codex" selection={{ sidebar: codex.current.id }} defaultCompactColumn="supplementary" supplementaryVisible={codex.current.kind === 'dot'}>
          <ChatSidebar codex={codex} inbox={inbox} />
          <ChatPane codex={codex} />
          <DetailPane codex={codex} />
        </SplitView>
      </BLProvider>
    </AppearanceProvider>
  );
}

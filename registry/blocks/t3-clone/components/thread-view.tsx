import { ConversationAssistantMessage, Conversation, ConversationComposer, ConversationEmpty, ConversationMessages, ConversationSuggestions, ConversationMarkdown, ConversationSuggestion, ConversationToolCall, ConversationUserMessage, ConversationWorkLog } from '@/components/ui/conversation';
import { SettledBanner } from './settled-banner';
import { WorkbenchComposer, stripAttachmentRefs } from './workbench/workbench-composer';
import { SUGGESTIONS } from '../lib/data';
import type { ThreadsState } from '../lib/use-threads';

/** The conversation: greeting + centred composer when empty, messages over a docked composer after. */
export function ThreadView({ state }: { state: ThreadsState }) {
  const thread = state.current;
  return (
    <Conversation empty={!thread}>
      <ConversationEmpty title="What are we building?" description="Start a thread — ask anything about this workspace." />

      <ConversationMessages threadKey={thread?.id} streaming={state.streaming}>
        {thread?.messages.map((m) =>
          m.role === 'user' ? (
            <ConversationUserMessage key={m.id} attachments={m.images?.map((src, i) => ({ id: `${m.id}-${i}`, name: `Image ${i + 1}`, src, kind: 'image' }))}>
              {m.text}
            </ConversationUserMessage>
          ) : (
            <ConversationAssistantMessage key={m.id}>
              {m.summary && (
                <ConversationWorkLog summary={m.summary}>
                  {m.steps?.map((s, i) => <ConversationToolCall key={i} {...s} />)}
                </ConversationWorkLog>
              )}
              <ConversationMarkdown markdown={m.text} streaming={m.live} />
            </ConversationAssistantMessage>
          ),
        )}
      </ConversationMessages>

      <ConversationComposer>
        {thread?.settled && <SettledBanner onUnsettle={state.unsettle} />}
        <WorkbenchComposer
          autoFocus={!thread}
          streaming={state.streaming}
          onStop={state.stop}
          onSubmit={(markdown, files) => state.send(stripAttachmentRefs(markdown), files.flatMap((f) => (f.src ? [f.src] : [])))}
        />
      </ConversationComposer>

      <ConversationSuggestions>
        {SUGGESTIONS.map((s) => (
          <ConversationSuggestion key={s} onClick={() => state.send(s)}>
            {s}
          </ConversationSuggestion>
        ))}
      </ConversationSuggestions>
    </Conversation>
  );
}

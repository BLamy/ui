import { AssistantMessage, Conversation, ConversationComposer, ConversationEmpty, ConversationGreeting, ConversationMessages, ConversationSuggestions, MessageMarkdown, SettledBanner, Suggestion, ToolCall, UserMessage, WorkLog } from '@brett_lamy/ui';
import { WorkbenchComposer, stripAttachmentRefs } from './workbench/workbench-composer';
import { SUGGESTIONS } from '../lib/data';
import type { ThreadsState } from '../lib/use-threads';

/** The conversation: greeting + centred composer when empty, messages over a docked composer after. */
export function ThreadView({ state }: { state: ThreadsState }) {
  const thread = state.current;
  return (
    <Conversation empty={!thread}>
      <ConversationEmpty>
        <ConversationGreeting title="What are we building?" description="Start a thread — ask anything about this workspace." />
      </ConversationEmpty>

      <ConversationMessages threadKey={thread?.id} streaming={state.streaming}>
        {thread?.messages.map((m) =>
          m.role === 'user' ? (
            <UserMessage key={m.id} images={m.images}>
              {m.text}
            </UserMessage>
          ) : (
            <AssistantMessage key={m.id}>
              {m.summary && (
                <WorkLog summary={m.summary}>
                  {m.steps?.map((s, i) => <ToolCall key={i} {...s} />)}
                </WorkLog>
              )}
              <MessageMarkdown markdown={m.text} streaming={m.live} />
            </AssistantMessage>
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
          <Suggestion key={s} onPress={() => state.send(s)}>
            {s}
          </Suggestion>
        ))}
      </ConversationSuggestions>
    </Conversation>
  );
}

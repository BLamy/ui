/* Ask QA — the agent beside every page. Empty, a greeting over a centred composer with suggestions; the first
   message flies the composer to its dock. Replies show their tool calls in a work log, stream in word by word
   (Markdown, code included), and a reply that starts a run carries the live run card, which fills in place. */
import {
  AssistantMessage, Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerText,
  Conversation, ConversationComposer, ConversationEmpty, ConversationGreeting, ConversationMessages, ConversationSuggestions,
  MessageMarkdown, Suggestion, ToolCall, UserMessage, WorkLog,
} from '@brett_lamy/ui';
import { SUGGESTIONS } from './agent';
import { PROJECTS } from './data';
import { BarButton, LoopMark } from './parts';
import { RunCard } from './runs';
import { useLoopQA } from './state';

export function AskTitle() {
  return (
    <span className="inline-flex items-center gap-2 text-[15px]">
      <LoopMark size={22} />Ask QA
    </span>
  );
}

export function AskQA() {
  const qa = useLoopQA();
  const project = qa.project ?? PROJECTS[0]!;
  const empty = qa.messages.length === 0;
  return (
    <div data-slot="ask-qa" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[12px] text-muted-foreground">
          <span className="size-2 shrink-0 rounded-[3px] bg-(--brand)" style={{ '--brand': project.brand } as React.CSSProperties} />
          <span className="truncate">{project.name}</span>
        </span>
        <span className="flex-1" />
        <BarButton label="New chat" icon="square-pencil" className="size-7" isDisabled={empty} onPress={qa.newChat} />
      </div>
      <Conversation empty={empty} className={empty ? 'px-4 py-6' : undefined}>
        <ConversationEmpty>
          <ConversationGreeting
            icon={<LoopMark size={40} className="mx-auto" />}
            title="Ask QA"
            description={`Ask about ${project.name}'s bugs, runs and replays — or have it start a run.`}
          />
        </ConversationEmpty>
        <ConversationMessages threadKey={project.id} streaming={!!qa.streaming}>
          {qa.messages.map((m) => m.role === 'user' ? (
            <UserMessage key={m.id} className="px-3.5">{m.text}</UserMessage>
          ) : (
            <AssistantMessage key={m.id} className="px-3.5 text-[13.5px]">
              {m.tools?.length ? (
                <WorkLog summary={m.worked ?? 'Worked'} className="mb-2">
                  {m.tools.map((t) => <ToolCall key={t.title} icon={t.icon} title={t.title} detail={t.detail} />)}
                </WorkLog>
              ) : null}
              <MessageMarkdown markdown={m.text} streaming={qa.streaming === m.id} />
              {m.runId && qa.streaming !== m.id ? <RunCard runId={m.runId} compact className="mt-3" /> : null}
            </AssistantMessage>
          ))}
        </ConversationMessages>
        <ConversationComposer className={empty ? undefined : 'px-3 pb-3'}>
          <Composer streaming={!!qa.streaming} onStop={qa.stopStreaming} onSubmit={(md) => md.trim() && qa.send(md.trim())}>
            <ComposerCard>
              <ComposerInput placeholder="Ask QA a question or start a run…" />
              <ComposerFooter>
                <ComposerText icon="sparkle">{project.name}</ComposerText>
                <ComposerSpacer />
                <ComposerSend />
              </ComposerFooter>
            </ComposerCard>
          </Composer>
        </ConversationComposer>
        <ConversationSuggestions>
          {SUGGESTIONS.map((s) => <Suggestion key={s} onPress={() => qa.send(s)}>{s}</Suggestion>)}
        </ConversationSuggestions>
      </Conversation>
    </div>
  );
}

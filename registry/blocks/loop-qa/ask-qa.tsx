/* Ask QA — the agent beside every page, on an ArtifactChatContainer: the page (a project, a bug, a run) is the
   artifact, and the chat docks beside it on the trailing edge when there's room, or floats over it as a composer
   whose top bump carries the transcript (the newest reply peeking) when there isn't. Folded, it waits as a FAB.
   Empty, the thread is a greeting with suggestions; replies show their tool calls in a work log, stream in word
   by word (Markdown, code included), and a reply that starts a run carries the live run card, which fills in
   place. The transcript and the composer are rendered once, so a draft or a streaming reply survives the switch
   between docked and floating. */
import type { CSSProperties } from 'react';
import { useArtifactChatContainer } from '@/components/ui/artifact-chat-container';
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerText } from '@/components/ui/composer';
import { ConversationAssistantMessage, Conversation, ConversationEmpty, ConversationMessages, ConversationSuggestions, ConversationMarkdown, ConversationSuggestion, ConversationToolCall, ConversationUserMessage, ConversationWorkLog } from '@/components/ui/conversation';
import { SUGGESTIONS } from './agent';
import { PROJECTS } from './data';
import { BarButton, LoopMark } from './parts';
import { RunCard } from './runs';
import { useLoopQA } from './state';

export function AskTitle() {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-subhead font-semibold whitespace-nowrap">
      <LoopMark size={22} />Ask QA
    </span>
  );
}

/** The transcript: a bar (title, the project it answers about, new chat, hide), then the thread. */
export function AskQA() {
  const qa = useLoopQA();
  const chat = useArtifactChatContainer();
  const project = qa.project ?? PROJECTS[0]!;
  const empty = qa.messages.length === 0;
  return (
    <div data-slot="ask-qa" className="flex h-full min-h-0 flex-col text-detail text-foreground">
      <div className="box-border flex h-toolbar shrink-0 items-center gap-2 border-b border-border pr-2 pl-3.5">
        <AskTitle />
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-caption text-muted-foreground">
          <span className="size-2 shrink-0 rounded-[3px] bg-(--brand)" style={{ '--brand': project.brand } as CSSProperties} />
          <span className="truncate">{project.name}</span>
        </span>
        <span className="flex-1" />
        <BarButton label="New chat" icon="square-pencil" className="size-8" disabled={empty} onClick={qa.newChat} />
        {chat.presentation === 'floating' ? (
          <BarButton label="Collapse chat" icon="chevron-down" className="size-8" onClick={() => qa.setChatOpen(false)} />
        ) : (
          <BarButton label="Hide Ask QA (⌘J)" icon="sidebar-right" className="size-8" onClick={() => qa.setAskOpen(false)} />
        )}
      </div>
      <Conversation empty={empty} className={empty ? 'px-4 py-6' : undefined}>
        <ConversationEmpty
            icon={<LoopMark size={40} className="mx-auto" />}
            title="Ask QA"
            description={`Ask about ${project.name}'s bugs, runs and replays — or have it start a run.`} />
        <ConversationMessages threadKey={project.id} streaming={!!qa.streaming}>
          {qa.messages.map((m) => m.role === 'user' ? (
            <ConversationUserMessage key={m.id} className="px-3.5">{m.text}</ConversationUserMessage>
          ) : (
            <ConversationAssistantMessage key={m.id} className="px-3.5 text-[13.5px]">
              {m.tools?.length ? (
                <ConversationWorkLog summary={m.worked ?? 'Worked'} className="mb-2">
                  {m.tools.map((t) => <ConversationToolCall key={t.title} icon={t.icon} title={t.title} description={t.detail} />)}
                </ConversationWorkLog>
              ) : null}
              <ConversationMarkdown markdown={m.text} streaming={qa.streaming === m.id} />
              {m.runId && qa.streaming !== m.id ? <RunCard runId={m.runId} density="compact" className="mt-3" /> : null}
            </ConversationAssistantMessage>
          ))}
        </ConversationMessages>
        <ConversationSuggestions>
          {SUGGESTIONS.map((s) => <ConversationSuggestion key={s} onClick={() => qa.send(s)}>{s}</ConversationSuggestion>)}
        </ConversationSuggestions>
      </Conversation>
    </div>
  );
}

/** The composer: docked under the thread, or floating over the page. */
export function AskComposer() {
  const qa = useLoopQA();
  const project = qa.project ?? PROJECTS[0]!;
  return (
    <div className="p-2">
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
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Haptics } from '@brett_lamy/ui';
import { REPLIES, THREADS, type Thread } from './data';

/**
 * Thread state plus a fake agent that streams canned replies word by word.
 * Replace `send` with a call to your agent backend.
 */
export function useThreads(initial: string | null = 't1') {
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const [currentId, setCurrentId] = useState<string | null>(initial);
  const [live, setLive] = useState<{ thread: string; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const turn = useRef(0);
  useEffect(() => () => clearInterval(timer.current ?? undefined), []);

  const update = (id: string, fn: (t: Thread) => Thread) => setThreads((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  const patchMessage = (id: string, mid: string, patch: Partial<Thread['messages'][number]>) =>
    update(id, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === mid ? { ...m, ...patch } : m)) }));

  const stop = () => {
    clearInterval(timer.current ?? undefined);
    if (live) patchMessage(live.thread, live.message, { live: false, summary: 'Stopped' });
    setLive(null);
  };

  const send = (text: string, images?: string[]) => {
    clearInterval(timer.current ?? undefined);
    const now = Date.now();
    let id = currentId;
    if (!id) {
      id = 'n' + now;
      const title = (text || 'Image').length > 44 ? (text || 'Image').slice(0, 42) + '…' : text || 'Image';
      setThreads((ts) => [{ id: id as string, title, age: 'now', settled: false, messages: [] }, ...ts]);
      setCurrentId(id);
    }
    const tid = id;
    const mid = 'a' + now;
    update(tid, (t) => ({
      ...t,
      settled: false,
      messages: [...t.messages, { id: 'u' + now, role: 'user', text, images }, { id: mid, role: 'assistant', text: '', live: true }],
    }));
    const words = REPLIES[turn.current++ % REPLIES.length].split(' ');
    let i = 0;
    setLive({ thread: tid, message: mid });
    timer.current = setInterval(() => {
      i += 3 + Math.floor(Math.random() * 5);
      if (i < words.length) return patchMessage(tid, mid, { text: words.slice(0, i).join(' ') });
      clearInterval(timer.current ?? undefined);
      const secs = Math.max(1, Math.round((Date.now() - now) / 1000));
      patchMessage(tid, mid, {
        text: words.join(' '),
        live: false,
        summary: `Worked for ${secs}s`,
        steps: [{ title: 'Parsed the request' }, { title: 'Searched the workspace', detail: 'rg -n' }, { title: 'Drafted and streamed the reply' }],
      });
      setLive(null);
      Haptics.notification('success');
    }, 90);
  };

  const current = threads.find((t) => t.id === currentId) ?? null;
  return {
    threads,
    current,
    select: setCurrentId,
    newThread: () => setCurrentId(null),
    streaming: !!current && live?.thread === current.id,
    send,
    stop,
    unsettle: () => current && update(current.id, (t) => ({ ...t, settled: false })),
  };
}
export type ThreadsState = ReturnType<typeof useThreads>;

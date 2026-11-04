'use client';
import { useSyncExternalStore } from 'react';
import { Button as AriaButton, Dialog } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { Icon } from '@/lib/icon';
import { languageFromPath } from '@/lib/syntax';
import { cn } from '@/lib/utils';
import { detectEol, detectIndentation, languageName } from './files';
import type { RuntimeStatus, RuntimeTone } from './runtime';
import type { VSCodeStore } from './store';

const TONE_ICON: Record<RuntimeTone, string> = { neutral: 'shield', safe: 'shield-check', warning: 'shield-exclamation' };
const TONE_COLOR: Record<RuntimeTone, string> = { neutral: 'text-muted-foreground', safe: 'text-success', warning: 'text-warning' };

/** What the runtime says about itself, and what it offers. */
function RuntimeDetails({ status, close }: { status: RuntimeStatus; close: () => void }) {
  const tone = status.tone ?? 'neutral';
  return (
    <div className="flex max-w-[320px] flex-col gap-2.5 p-3.5 text-footnote">
      <div className="flex items-center gap-2 font-semibold">
        <Icon name={TONE_ICON[tone]} size={16} className={TONE_COLOR[tone]} />
        {status.title ?? status.text}
      </div>
      {status.details?.map((detail) => <p key={detail} className={cn('m-0', status.state === 'failed' ? 'text-foreground' : 'text-muted-foreground')}>{detail}</p>)}
      {status.actions?.length ? (
        <div className="flex gap-2">
          {status.actions.map((action) => (
            <Button key={action.label} variant="quiet" onPress={() => { action.run(); close(); }}>{action.label}</Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Item({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <span className={wide ? 'hidden truncate @2xl/vscode:inline' : 'truncate'}>{children}</span>;
}

/** Facts about the file in use, and the runtime's state. */
export function StatusBar({ store }: { store: VSCodeStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const path = store.activePath;
  const text = path ? store.text(path) : undefined;
  const cursor = store.cursor(path);
  const language = path ? languageName(languageFromPath(path)) : null;
  const indent = text === undefined ? null : detectIndentation(text);
  const { status, problem } = store;
  return (
    <footer data-slot="vscode-status-bar" className={cn('flex h-[22px] shrink-0 items-center justify-between gap-3 overflow-hidden px-2 text-caption2', status.state === 'failed' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground')}>
      <div className="flex min-w-0 items-center gap-3">
        <PopoverTrigger>
          <AriaButton
            aria-label={`${status.text}. Details`}
            data-state={status.state}
            className="flex h-[22px] min-w-0 cursor-pointer items-center gap-1 rounded-none border-0 bg-transparent px-1 [font-family:inherit] text-caption2 text-inherit outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary-foreground/70 data-focus-visible:ring-inset data-hovered:bg-primary-foreground/15"
          >
            <Icon name={TONE_ICON[status.tone ?? 'neutral']} size={12} className="shrink-0" />
            <span className="truncate" data-slot="vscode-runtime-status">{status.text}</span>
          </AriaButton>
          <Popover placement="top start">
            <Dialog className="outline-none" aria-label={status.title ?? status.text}>
              {({ close }) => <RuntimeDetails status={status} close={close} />}
            </Dialog>
          </Popover>
        </PopoverTrigger>
        {problem ? <span role="status" className="min-w-0 truncate">{problem}</span> : null}
      </div>
      {path ? (
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap" data-slot="vscode-file-status">
          <Item>Ln {cursor?.line ?? 1}, Col {(cursor?.column ?? 0) + 1}</Item>
          {indent ? <Item wide>{indent.kind === 'tabs' ? 'Tabs' : `Spaces: ${indent.size}`}</Item> : null}
          {text !== undefined ? <Item wide>UTF-8</Item> : null}
          {text !== undefined ? <Item wide>{detectEol(text)}</Item> : null}
          {language ? <Item>{language}</Item> : null}
        </div>
      ) : null}
    </footer>
  );
}

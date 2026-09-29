import { createContext, useContext, useState, type ComponentProps, type ReactNode } from 'react';
import { Button, Input, composeRenderProps } from 'react-aria-components';
import { Icon } from '../../lib/icon';
import { Haptics } from '../../lib/haptics';
import { cn } from '../../lib/utils';

/* ══ ChatComposer — the message field ══
   <ChatComposer onSend={send} placeholder="Message #dev" />      // input + send button
   <ChatComposer onSend={send}>                                  // or compose it
     <ChatComposerAction aria-label="Attach"><Icon name="plus" size={16} sw={1.9} /></ChatComposerAction>
     <ChatComposerInput placeholder="Message #dev" />
     <ChatComposerSend />
   </ChatComposer>
   Enter sends; the field clears after a send. */

interface ChatComposerContextValue {
  value: string;
  setValue: (v: string) => void;
  send: () => void;
}
const ChatComposerContext = createContext<ChatComposerContextValue | null>(null);

function useComposer(part: string) {
  const ctx = useContext(ChatComposerContext);
  if (!ctx) throw new Error(`<${part}> must be used within <ChatComposer>`);
  return ctx;
}

export interface ChatComposerProps extends Omit<ComponentProps<'div'>, 'onChange'> {
  onSend: (text: string) => void;
  /** placeholder of the default input */
  placeholder?: string;
  /** focus the default input on mount */
  autoFocus?: boolean;
  /** controlled draft */
  value?: string;
  onValueChange?: (value: string) => void;
}

export function ChatComposer({ onSend, placeholder, autoFocus, value: valueProp, onValueChange, className, children, ...props }: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const value = valueProp ?? draft;
  const setValue = (v: string) => {
    setDraft(v);
    onValueChange?.(v);
  };
  const send = () => {
    if (!value.trim()) return;
    Haptics.impact('medium');
    onSend(value.trim());
    setValue('');
  };
  return (
    <ChatComposerContext.Provider value={{ value, setValue, send }}>
      <div
        data-slot="chat-composer"
        className={cn('flex items-center gap-[8px] rounded-[12px] border border-border bg-card py-[4px] pr-[4px] pl-[13px]', className)}
        {...props}
      >
        {children ?? (
          <>
            <ChatComposerInput placeholder={placeholder} autoFocus={autoFocus} />
            <ChatComposerSend />
          </>
        )}
      </div>
    </ChatComposerContext.Provider>
  );
}

export function ChatComposerInput({ className, onKeyDown, ...props }: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const { value, setValue, send } = useComposer('ChatComposerInput');
  return (
    <Input
      data-slot="chat-composer-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') send();
        onKeyDown?.(e);
      }}
      className={composeRenderProps(className, (c) =>
        cn('min-w-0 flex-1 border-0 bg-transparent px-0 py-[7px] font-ios text-[13.5px] text-foreground outline-none', c),
      )}
      {...props}
    />
  );
}

export interface ChatComposerSendProps extends Omit<ComponentProps<typeof Button>, 'children'> {
  children?: ReactNode;
}

/** Sends the draft; tinted once there is something to send. */
export function ChatComposerSend({ className, children, ...props }: ChatComposerSendProps) {
  const { value, send } = useComposer('ChatComposerSend');
  const ready = !!value.trim();
  return (
    <Button
      data-slot="chat-composer-send"
      data-ready={ready || undefined}
      aria-label="Send"
      onPress={send}
      className={composeRenderProps(className, (c) =>
        cn(
          'grid size-[32px] shrink-0 cursor-pointer place-items-center rounded-[9px] border-0 [transition:background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] data-pressed:scale-[.94] motion-reduce:transition-none',
          ready ? 'bg-primary text-white' : 'bg-secondary-strong text-secondary-foreground',
          c,
        ),
      )}
      {...props}
    >
      {children ?? <Icon name="arrow-up-compact" size={15} sw={2.2} />}
    </Button>
  );
}

/** A secondary button inside the field (attach, emoji…). */
export function ChatComposerAction({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="chat-composer-action"
      className={composeRenderProps(className, (c) =>
        cn('-ml-[5px] grid size-[28px] shrink-0 cursor-pointer place-items-center rounded-[8px] border-0 bg-transparent text-tertiary-foreground data-hovered:text-muted-foreground', c),
      )}
      {...props}
    />
  );
}

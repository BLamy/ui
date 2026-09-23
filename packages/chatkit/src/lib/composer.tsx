import { useState, type CSSProperties } from 'react';
import { Button, Input } from 'react-aria-components';
import { ChatIcon, chatIconPaths } from './chat-icon';
import { cn } from './cn';
import { kvib } from './kvib';

export interface ComposerProps {
  placeholder?: string;
  onSend: (text: string) => void;
  tint: string;
  autoFocus?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Composer({ placeholder, onSend, tint, autoFocus, className, style }: ComposerProps) {
  const [v, setV] = useState('');
  const send = () => {
    if (!v.trim()) return;
    kvib([8]);
    onSend(v.trim());
    setV('');
  };
  return (
    <div
      data-slot="composer"
      className={cn(
        'flex items-center gap-[8px] rounded-[12px] border border-[rgba(255,255,255,.07)] bg-[#1B1B22] py-[4px] pr-[4px] pl-[13px]',
        className,
      )}
      style={{ '--ck-tint': tint, ...style } as CSSProperties}
    >
      <Input
        value={v}
        autoFocus={autoFocus}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent px-0 py-[7px] font-ios text-[13.5px] text-[#EDEDF2] outline-none"
      />
      <Button
        onPress={send}
        aria-label="Send"
        className={cn(
          'grid size-[32px] shrink-0 cursor-pointer place-items-center rounded-[9px] border-0 text-white transition-[background] duration-200 ease-[ease]',
          v.trim() ? 'bg-(--ck-tint)' : 'bg-[rgba(255,255,255,.1)]',
        )}
      >
        <ChatIcon d={chatIconPaths.send} size={15} sw={2.2} />
      </Button>
    </div>
  );
}

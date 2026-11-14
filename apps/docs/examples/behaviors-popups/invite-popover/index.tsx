import {
  createPopup,
  definePrimitive,
  popupClose,
  popupContent,
  popupDescription,
  popupState,
  popupTitle,
  popupTrigger,
  type ChangeDetails,
} from '@ui-sdk/core';
import { popoverPreset } from '@ui-sdk/core/popover';
import { createParts } from '@ui-sdk/react/primitive';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { popoverMotion, popoverSurface } from '@/lib/primitives';
import { cn } from '@/lib/utils';

type InviteOptions = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: ChangeDetails<string>) => void;
};

/* A popup of our own: `createPopup` with the popover preset gives it placement beside the trigger, Escape and
   outside-press dismissal, focus moving in and back, and `onOpenChange` with a reason. The slot helpers give each
   part its role and ARIA wiring. */
const invite = definePrimitive({
  name: 'invite',
  options: { open: 'boolean', defaultOpen: 'boolean', onOpenChange: 'callback' },
  state: (options: InviteOptions) => popupState(options),
  sync: (options) => (options.open === undefined ? {} : { open: options.open }),
  api: (context) => createPopup(context, { preset: popoverPreset }),
  slots: (slot) => ({
    trigger: popupTrigger(slot),
    content: popupContent(slot),
    title: popupTitle(slot),
    description: popupDescription(slot),
    close: popupClose(slot),
  }),
  agent: { actions: ['open', 'close'] },
});

const {
  Root: Invite,
  Trigger: InviteTrigger,
  Content: InviteContent,
  Title: InviteTitle,
  Description: InviteDescription,
  Close: InviteClose,
} = createParts(invite, { trigger: 'button', content: 'div', title: 'h2', description: 'p', close: 'button' });

export default function InvitePopoverDemo() {
  const [log, setLog] = useState('Closed');
  return (
    <div className="grid justify-items-center gap-3">
      <Invite onOpenChange={(open: boolean, details: ChangeDetails<string>) => setLog(`${open ? 'Opened' : 'Closed'} · ${details.reason}`)}>
        <InviteTrigger className={buttonVariants({ variant: 'secondary' })}>Invite</InviteTrigger>
        <InviteContent sideOffset={8} className={cn(popoverSurface, popoverMotion, 'grid w-72 gap-2 p-4')}>
          <InviteTitle className="m-0 text-body font-semibold text-foreground">Invite people</InviteTitle>
          <InviteDescription className="m-0 text-footnote text-foreground/70">Anyone with the link can join.</InviteDescription>
          <input
            readOnly
            aria-label="Invite link"
            value="https://example.com/s/7f3a"
            className="h-9 rounded-ctl border-0 bg-secondary px-3 text-body text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
          />
          <InviteClose className={cn(buttonVariants({ size: 'sm' }), 'justify-self-end')}>Done</InviteClose>
        </InviteContent>
      </Invite>
      <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
        {log}
      </p>
    </div>
  );
}

import { createChange, definePrimitive, type ChangeDetails } from '@brett_lamy/ui/sdk/core';
import { createParts } from '@brett_lamy/ui/sdk/react/primitive';
import { useState, type ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { cx } from '@/lib/utils';

/* ── lib/mute-button-model.ts: the behavior, no React ──
   One piece of state, `pressed`, controlled or not, changed only through `createChange`, so `onPressedChange`
   hears every change with a reason and can cancel it. The slot turns state into attributes (`aria-pressed`, and
   `data-pressed` for styles) and a press into a change. */
type MuteReason = 'press' | 'imperative';
type MuteOptions = {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean, details: ChangeDetails<MuteReason>) => void;
};

const muteButton = definePrimitive({
  name: 'mute-button',
  options: { pressed: 'boolean', defaultPressed: 'boolean', onPressedChange: 'callback' },
  state: (options: MuteOptions) => ({ pressed: options.pressed ?? options.defaultPressed ?? false }),
  sync: (options) => (options.pressed === undefined ? {} : { pressed: options.pressed }),
  api: (context) => {
    const change = createChange(context);
    return {
      setPressed: (pressed: boolean, details: { reason?: MuteReason; event?: Event } = {}) =>
        change('pressed', pressed, { reason: details.reason ?? 'imperative', event: details.event }),
      toggle: (event?: Event) => change('pressed', !context.store.get().pressed, { reason: 'press', event }),
    };
  },
  slots: (slot) => ({
    root: slot<object, { pressed: boolean }>({
      state: (state) => ({ pressed: state.pressed }),
      attrs: (state) => ({ type: 'button', 'aria-pressed': String(state.pressed), 'data-pressed': state.pressed ? '' : undefined }),
      press: ({ api }, event) => api.toggle(event),
    }),
  }),
  agent: { actions: ['setPressed', 'toggle'] },
});

/* ── components/mute-button.tsx: the parts, with the kit's look ──
   Tokens only (radii, colors, the text scale, the snappy spring), state from the platform (`hover:`, `active:`,
   `focus-visible:`) and from the primitive (`data-pressed:`), and `cx` to merge a className that may be a
   function of the part's state. */
const { Root } = createParts(muteButton, { root: 'button' });

const muteButtonVariants = cva(
  'inline-flex h-9 cursor-pointer items-center gap-2 rounded-ctl border-0 bg-secondary px-4 text-subhead font-semibold text-secondary-foreground outline-none [font-family:inherit] transition-[scale,background-color] duration-spring-snappy ease-spring-snappy hover:bg-secondary-strong active:scale-[.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-pressed:bg-destructive data-pressed:text-white motion-reduce:transition-none',
);

function MuteButton({ className, ...props }: ComponentProps<typeof Root>) {
  return <Root className={cx(muteButtonVariants(), className)} {...props} />;
}

export default function MuteButtonDemo() {
  const [log, setLog] = useState('Not muted');
  return (
    <div className="grid justify-items-center gap-3">
      <MuteButton onPressedChange={(pressed: boolean, details: ChangeDetails<MuteReason>) => setLog(`${pressed ? 'Muted' : 'Not muted'} · ${details.reason}`)}>
        {/* The name stays "Mute": aria-pressed says whether it is on. */}
        <Icon name="speaker" size={16} />
        Mute
      </MuteButton>
      <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
        {log}
      </p>
    </div>
  );
}

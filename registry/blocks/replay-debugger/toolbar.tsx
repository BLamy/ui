'use client';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import { DebugToolbar, type DebugToolbarAction } from '@/components/ui/debug-toolbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { useState } from 'react';
import type { NavigationKind, StepLink } from './host';
import { frameName, sourceName, type DebuggerModel } from './model';
import { useModel } from './use-model';
const Navigation: Partial<Record<DebugToolbarAction, NavigationKind>> = {
  continue: 'continue',
  'step-over': 'stepOver',
  'step-into': 'stepIn',
  'step-out': 'stepOut',
  'step-back': 'stepInBack',
  'reverse-continue': 'rewind',
};
export function formatMs(ms: number) {
  const a = Math.abs(ms);
  const sign = ms < 0 ? '−' : '';
  return a >= 10000
    ? `${sign}${(a / 1000).toFixed(2)} s`
    : `${sign}${a.toFixed(3)} ms`;
}
const IdleLabels = {
  before: "JS hasn't started",
  between: 'No JS running',
  after: 'JS has finished',
  none: 'This recording ran no JS',
  elsewhere: "This part isn't indexed yet",
};
/** Stepping, in every direction. */
export function StepButtons({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  useModel(model, (m) => m.version);
  const disabled: DebugToolbarAction[] = [];
  const summary = model.summary;
  if (!summary?.steps) disabled.push('continue', 'step-over', 'step-into', 'step-out', 'step-back', 'reverse-continue', 'restart', 'stop');
  else {
    if (model.stackFrames().length <= 1) disabled.push('step-out');
    if (!model.host.restartPlayback) disabled.push('restart');
    if (!model.host.stopPlayback) disabled.push('stop');
  }
  return (
    <DebugToolbar
      size="compact"
      className={cn('debugger-steps h-9 max-w-full overflow-x-auto rounded-none border-0 bg-transparent px-0 shadow-none [&_.codicon-gripper]:hidden [&_button]:size-7 [&_button_.codicon]:text-info [&_button_.codicon]:text-body [&_button[data-disabled]_.codicon]:grayscale [&_button:hover:not([data-disabled])]:bg-secondary [&_button:active:not([data-disabled])]:bg-secondary-strong [&_button[data-action=continue]_.codicon]:text-success [&_button[data-action=reverse-continue]_.codicon]:text-success [&_button[data-action=restart]_.codicon]:text-success [&_button[data-action=stop]_.codicon]:text-destructive', className)}
      style={style}
      disabledActions={disabled}
      onAction={(action) => {
        const how = Navigation[action];
        if (how) void model.navigate(how);
        else {
          const perform = action === 'restart' ? model.host.restartPlayback : model.host.stopPlayback;
          if (perform) void Promise.resolve().then(perform).catch((error: Error) => model.host.status(error.message, { error: true }));
        }
      }}
    />
  );
}
function Links({ groups }: { groups: StepLink[][] }) {
  return (
    <>
      {groups.map((links) => (
        <span
          key={links[0].id}
          className="debugger-links inline-flex flex-wrap gap-0.5 ms-1.5 align-middle"
        >
          {links.map((link) => (
            <Button
              key={link.id}
              variant="quiet"
              size="sm"
              className="debugger-request h-5 px-1.5 text-caption2 font-medium text-primary max-w-full overflow-hidden text-ellipsis"
              data-slot="debugger-request"
              title={link.title}
              onClick={link.onClick}
            >
              {link.label}
            </Button>
          ))}
        </span>
      ))}
    </>
  );
}
/** Where this is: paused in what, at which step, and what the moment has to do with anything else. */
export function DebuggerPosition({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  // What's here changes with everything that can move.
  useModel(model, (m) => m.version);
  const { idle, stepInfo: info, summary, pause, playheadMs } = model;
  if (idle) {
    const loc = model.viewed(info?.location);
    const source = loc ? model.sourceEntries.get(loc.sourceId) : undefined;
    const nextStep = idle.nextStep ?? -1;
    return (
      <div
        className={cn(
          'debugger-position block flex-[1_1_260px] min-w-0 max-h-[62px] overflow-x-hidden overflow-y-auto text-caption leading-4 [&.idle]:flex [&.idle]:items-center [&.idle]:gap-2 idle',
          className,
        )}
        data-slot="debugger-position"
        data-idle={idle.kind}
        style={style}
      >
        <span className="debugger-idle-text flex-1 min-w-0">
          <span className="debugger-idle font-semibold">
            {IdleLabels[idle.kind]}
          </span>
          <span className="debugger-muted text-muted-foreground text-caption2">
            {idle.kind === 'elsewhere'
              ? model.scrubbing
                ? ' · it will be when you stop here'
                : model.windowText
                  ? ` · ${model.windowText}`
                  : ''
              : ''}
            {loc ? ` · last ran ${sourceName(source)}:${loc.line}` : ''}
            {idle.nextMs !== undefined && playheadMs !== null
              ? ` · next JS in ${formatMs(idle.nextMs - playheadMs)}`
              : ''}
          </span>
        </span>
        {nextStep >= 0 ? (
          <Button
            variant="secondary"
            size="sm"
            data-slot="debugger-next-js"
            className="debugger-next-js shrink-0 h-6 px-2"
            onClick={() => void model.pauseAt(nextStep)}
          >
            Go to next JS
          </Button>
        ) : null}
      </div>
    );
  }
  if (!info || !summary)
    return (
      <div
        className={cn(
          'debugger-position block flex-[1_1_260px] min-w-0 max-h-[62px] overflow-x-hidden overflow-y-auto text-caption leading-4 [&.idle]:flex [&.idle]:items-center [&.idle]:gap-2',
          className,
        )}
        data-slot="debugger-position"
        style={style}
      />
    );
  const loc = model.viewed(info.location);
  const source = loc ? model.sourceEntries.get(loc.sourceId) : undefined;
  const frame = model.stackFrames()[0];
  const links = model.host.describeStep?.(info);
  return (
    <div
      className={cn(
        'debugger-position block flex-[1_1_260px] min-w-0 max-h-[62px] overflow-x-hidden overflow-y-auto text-caption leading-4 [&.idle]:flex [&.idle]:items-center [&.idle]:gap-2',
        className,
      )}
      data-slot="debugger-position"
      style={style}
    >
      <span className="debugger-paused me-1.5 inline-flex rounded-sm bg-warning/10 px-1.5 py-0.5 text-warning font-semibold">Paused</span>
      <span>{frame ? ` in ${frameName(frame)}` : ''}</span>
      {loc ? (
        <span className="debugger-mono font-mono text-caption">{` ${sourceName(source)}:${loc.line}:${loc.column ?? 0}`}</span>
      ) : null}
      <span className="debugger-muted text-muted-foreground text-caption2">
        {` · step ${info.index.toLocaleString()} of ${summary.steps.toLocaleString()} · progress ${info.progress.toLocaleString()}`}
        {pause?.ms !== undefined
          ? ` · replayed in ${Math.round(pause.ms)} ms`
          : ''}
        {!pause && model.windowText ? ` · ${model.windowText}` : ''}
      </span>
      {links?.length ? <Links groups={links} /> : null}
    </div>
  );
}
const DevToolsOpenTitle =
  'Open Chrome DevTools attached to this recording. It pauses at the start, like node --inspect-brk, and follows this playhead';
/** The way into Chrome DevTools: it opens attached to this recording, and other CDP clients can use the address. */
export function DevToolsControl({
  model,
  compact = false,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
  compact?: boolean;
}) {
  const clients = useModel(model, (m) => m.devToolsClients);
  const address = useModel(model, (m) => m.devToolsAddress);
  const [busy, setBusy] = useState(false);
  const { devTools, status } = {
    devTools: model.host.devTools,
    status: (
      text: string,
      options?: {
        error?: boolean;
        sticky?: boolean;
      },
    ) => model.host.status(text, options),
  };
  if (!devTools) return null;
  const open = async () => {
    setBusy(true);
    try {
      const reply = await devTools.open();
      model.devToolsAddress = reply.webSocketUrl;
      model.changed();
      if (reply.message)
        status(reply.message, { error: !reply.opened, sticky: !reply.opened });
      else if (reply.opened === 'restarted') status('Started over in DevTools');
    } catch (e) {
      status(`Couldn't open DevTools: ${(e as Error).message}`, {
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    await navigator.clipboard
      .writeText(address)
      .catch(() => document.execCommand('copy'));
    status('Copied the address');
  };
  return (
    <div
      className={cn(
        'debugger-devtools flex shrink-0 items-center gap-1 min-w-0 [&_[data-slot=debugger-devtools-open]]:h-6 [&_[data-slot=debugger-devtools-open]]:px-2 [&_[data-slot=debugger-devtools-copy]]:h-6 [&_[data-slot=debugger-devtools-copy]]:px-1.5',
        className,
      )}
      data-slot="debugger-devtools"
      style={style}
    >
      <Button
        variant="secondary"
        size="sm"
        data-slot="debugger-devtools-open"
        aria-label={clients ? 'Restart in DevTools' : 'Open in DevTools'}
        disabled={busy}
        title={
          clients
            ? 'Go back to the start of the recording in DevTools, and bring it to the front'
            : DevToolsOpenTitle
        }
        onClick={() => void open()}
      >
        {compact
          ? 'DevTools'
          : clients
            ? 'Restart in DevTools'
            : 'Open in DevTools'}
      </Button>
      <Input
        className="debugger-devtools-address w-[180px] min-w-0 h-[22px] px-1 py-0 border border-border rounded-sm bg-transparent text-muted-foreground font-mono text-caption2"
        data-slot="debugger-devtools-address"
        hidden={!address}
        readOnly
        spellCheck={false}
        value={address}
        title="For chrome://inspect, VS Code or any other CDP client"
        onClick={(e) => e.currentTarget.select()}
      />
      <Button
        variant="quiet"
        size="sm"
        className={address ? undefined : 'debugger-hidden hidden'}
        data-slot="debugger-devtools-copy"
        title="Copy the address"
        onClick={() => void copy()}
      >
        Copy
      </Button>
    </div>
  );
}
/** What goes over the code: stepping, where this is, and the way into DevTools. */
export function DebuggerToolbar({
  model,
  compact = false,
  devTools = true,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
  compact?: boolean;
  devTools?: boolean;
}) {
  const warning = useModel(model, (m) => m.summary?.timeline.warning ?? null);
  const engine = useModel(model, (m) => m.debugStatus());
  const applicationCodeOnly = useModel(model, (m) => m.applicationCodeOnly);
  const unavailable = useModel(model, (m) => m.applicationCodeUnavailable);
  return (
    <div
      className={cn(
        compact
          ? 'debugger-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 min-w-0 [&.compact]:px-2 [&.compact_.debugger-position]:basis-full compact'
          : 'debugger-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 min-w-0',
        className,
      )}
      data-slot="debugger-toolbar"
      style={style}
    >
      <StepButtons model={model} />
      <Toggle
        size="sm"
        pressed={applicationCodeOnly}
        onPressedChange={(pressed) => model.setApplicationCodeOnly(pressed)}
        title="Prefer application code when scrubbing. Turn off to include dependencies and runtime code."
        data-action="application-code-only"
        className="h-7 min-w-0 shrink-0 rounded-md px-2 text-caption font-medium text-muted-foreground data-pressed:bg-secondary data-pressed:text-foreground"
      >
        {applicationCodeOnly ? 'App code' : 'All code'}
      </Toggle>
      {devTools ? <DevToolsControl model={model} compact={compact} /> : null}
      {unavailable ? (
        <span role="status">
          No application code in this indexed part. Choose All code to inspect
          dependencies.
        </span>
      ) : null}
      <DebuggerPosition model={model} />
      {compact ? null : (
        <div
          className="debugger-engine basis-full min-w-0 shrink overflow-hidden text-muted-foreground text-caption2 whitespace-nowrap text-ellipsis"
          data-slot="debugger-engine"
        >
          {engine}
          {warning ? (
            <span className="debugger-warning text-warning" title={warning}>
              {' '}
              · JS times on the playhead are approximate
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

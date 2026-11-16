'use client';
import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import type { ChangeDetails, ChangeSource } from '@ui-sdk/core';
import type { VariantProps } from 'class-variance-authority';
import { Disclosure, DisclosurePanel, DisclosureTrigger } from '@/components/ui/disclosure';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Toggle, ToggleGroup } from '@/components/ui/toggle';
import { CRON_FIELDS, cronProblems, describeCron, isValidTimeZone, localTimeZone, nextCronRuns, validateCron } from '@/lib/cron';
import { describeCronError, useCronParse } from '@/lib/gpu-cron';
import { OccurrenceList, ZoneNote, previewPanelVariants, previewSubtle } from '@/lib/schedule-preview';
import { changeDetails } from '@/lib/change-details';
import { cn } from '@/lib/utils';

/* ══ CronEditor — edit a 5-field cron expression with its meaning in view.
   Without WebGPU (or with `naturalLanguage={false}`) the editor is the raw expression: one text field, with each of
   its five fields (minute, hour, day of month, month, day of week) labelled and checked on its own, an English
   description, preset chips and the next runs in any IANA time zone. All of that is local and works everywhere.
   Where the browser has WebGPU, the editor leads with a plain-English box ("every weekday at 9am"): gpu-cron turns
   the text into an expression on every keystroke and that becomes the value, so the runs (and your `onValueChange`)
   follow what you type. The expression it chose is always shown under the box, and "Edit expression" opens the raw
   editor to correct it by hand. The model always answers, even to nonsense, which is why the expression and the next
   runs stay in view: they are how you check it. Whichever box is showing, `name` submits the expression.

   CronEditor is a composite (two text boxes, presets, a preview), not one control, so it labels its own boxes
   (`label`, `naturalLanguageLabel`) instead of going in a Field; put it under a heading with a FieldSet and a
   FieldLegend.

   <CronEditor value={cron} onValueChange={setCron} timeZone="Europe/Paris" /> ══ */

export interface CronPreset {
  label: string;
  /** The 5-field expression the chip sets. */
  value: string;
}

/** The preset chips shown unless `presets` says otherwise. */
export const CRON_PRESETS: readonly CronPreset[] = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily at 9:00', value: '0 9 * * *' },
  { label: 'Weekdays at 9:00', value: '0 9 * * 1-5' },
  { label: 'Mondays at 9:00', value: '0 9 * * 1' },
  { label: 'First of the month', value: '0 0 1 * *' },
];

/** Why the expression changed: typing in the expression field (or the plain-English box, whose answer it is), a
    preset press, a form reset, or a call from code. */
export type CronEditorChangeReason = 'input-change' | 'clear-press' | 'item-press' | 'reset' | 'imperative';
export type CronEditorChangeDetails = ChangeDetails<CronEditorChangeReason>;

export interface CronEditorProps extends Omit<ComponentProps<'div'>, 'defaultValue' | 'onChange'>, VariantProps<typeof previewPanelVariants> {
  /** The expression (controlled). */
  value?: string;
  /** The initial expression when uncontrolled. */
  defaultValue?: string;
  /** Called with the new expression on every edit, a preset press, and every answer of the plain-English box.
      `details.cancel()` keeps the expression as it was (uncontrolled). */
  onValueChange?: (expression: string, details: CronEditorChangeDetails) => void;
  /** Label of the expression field. Default: "Cron expression". */
  label?: ReactNode;
  /** Help text under the expression field. */
  description?: ReactNode;
  /** Form field name: the expression is submitted under it (a hidden input), whichever box is showing. */
  name?: string;
  /** IANA zone the expression is read in for "Next runs". Default: this device's zone. */
  timeZone?: string;
  /** The moment "Next runs" counts from: a Date, epoch milliseconds or an ISO string. Default: now (read after
      mount, so the server and client render the same HTML, and refreshed every 30 seconds). */
  reference?: Date | number | string;
  /** How many upcoming runs to list. Default: 5. */
  nextRunCount?: number;
  /** Preset chips; `false` hides them. Default: `CRON_PRESETS`. */
  presets?: readonly CronPreset[] | false;
  /** Where WebGPU is available, edit through the plain-English box alone (the raw expression editor is the fallback).
      `false` never loads gpu-cron and always shows the raw expression. Default: true. */
  naturalLanguage?: boolean;
  /** Label of the plain-English box. Default: "Describe the schedule". */
  naturalLanguageLabel?: ReactNode;
  /** BCP 47 locale for the dates in "Next runs". Default: the browser's. */
  locale?: string;
  /** How the plain-English box is read: `debounceMs`, the wait after typing before asking the model (default 0,
      every keystroke). */
  parse?: { debounceMs?: number };
  disabled?: boolean;
}

/** The index (0–4) of the cron field the caret is in, or null past the fifth. */
function fieldAtCaret(expression: string, caret: number): number | null {
  const index = expression.slice(0, caret).trimStart().split(/\s+/).length - 1;
  return index < 5 ? index : null;
}

/** An English description of `expression`, loaded lazily; null while loading, for an invalid expression, and for a
    description that belongs to an earlier expression. */
function useCronDescription(expression: string): string | null {
  const [done, setDone] = useState<{ expression: string; text: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    describeCron(expression).then(
      (text) => {
        if (live) setDone({ expression, text });
      },
      () => {
        if (live) setDone({ expression, text: null });
      },
    );
    return () => {
      live = false;
    };
  }, [expression]);
  return done?.expression === expression ? done.text : null;
}

/** The current time, read after mount and refreshed every `every` ms; null until then (and when `fixed` is given,
    that moment instead). */
function useNow(fixed: Date | number | string | undefined, every = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (fixed !== undefined) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [fixed, every]);
  return fixed !== undefined ? new Date(fixed).getTime() : now;
}

export function CronEditor({
  value,
  defaultValue = '',
  onValueChange,
  label = 'Cron expression',
  description,
  name,
  timeZone,
  reference,
  nextRunCount = 5,
  presets = CRON_PRESETS,
  naturalLanguage = true,
  naturalLanguageLabel = 'Describe the schedule',
  locale,
  parse,
  disabled,
  variant,
  className,
  ...rest
}: CronEditorProps) {
  const [inner, setInner] = useState(defaultValue);
  const expression = value ?? inner;
  // The consumer hears first, and an uncontrolled editor only takes what they didn't cancel.
  const set = (next: string, details: CronEditorChangeDetails) => {
    onValueChange?.(next, details);
    if (value === undefined && !details.canceled) setInner(next);
  };

  const validation = useMemo(() => validateCron(expression), [expression]);
  const problems = useMemo(() => cronProblems(validation), [validation]);
  const empty = expression.trim() === '';
  const words = useCronDescription(expression);
  const [caretField, setCaretField] = useState<number | null>(null);

  const zone = useMemo(() => timeZone ?? localTimeZone(), [timeZone]);
  const now = useNow(reference);
  const runs = useMemo(() => {
    if (now === null || !validation.valid) return null;
    try {
      return nextCronRuns(expression, { from: now, count: nextRunCount, timeZone: zone });
    } catch {
      return null; // an unknown time zone: reported below
    }
  }, [expression, validation.valid, now, nextRunCount, zone]);
  const runFormat = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [locale, zone]);
  const nextId = useId();
  const zoneKnown = isValidTimeZone(zone);
  // While the plain-English box can run (or is still checking), it leads; without WebGPU, the raw editor does.
  const [support, setSupport] = useState<boolean | null>(null);
  // A newer answer is on its way from the model: the one shown is dimmed and marked busy.
  const [answering, setAnswering] = useState(false);
  // Disabled, the editor shows the expression itself (read-only).
  const plainEnglish = naturalLanguage && !disabled && support !== false;
  const unsupported = naturalLanguage && support === false;
  const [editing, setEditing] = useState(false);

  const raw = (
    <>
      <Field disabled={disabled} invalid={!empty && !validation.valid ? true : undefined}>
        <FieldLabel>{label}</FieldLabel>
        <Input
          value={expression}
          onValueChange={set}
          className="[font-family:var(--font-mono)]"
          placeholder="0 9 * * 1-5"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onSelectCapture={(e) => setCaretField(fieldAtCaret(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length))}
          onBlur={() => setCaretField(null)}
        />
        <FieldDescription>
          {description ?? 'Five fields, separated by spaces.'}
          {unsupported ? ' Describing a schedule in words needs WebGPU, which this browser does not offer.' : null}
        </FieldDescription>
        {problems.map((p) => (
          <FieldError key={`${p.field}-${p.message}`}>{p.message}</FieldError>
        ))}
      </Field>

      <dl data-slot="cron-editor-fields" className="m-0 grid grid-cols-5 gap-1.5">
        {CRON_FIELDS.map((f, i) => {
          const bad = validation.fields[f.name];
          const part = validation.parts[i];
          return (
            <div
              key={f.name}
              data-field={f.name}
              data-highlighted={caretField === i ? '' : undefined}
              data-invalid={bad ? '' : undefined}
              className="flex min-w-0 flex-col-reverse items-center justify-end gap-0.5 rounded-ctl px-1 py-1.5 text-center shadow-hairline ring-primary data-highlighted:ring-2 data-invalid:ring-2 data-invalid:ring-destructive"
            >
              <dt className={cn('text-caption2 leading-tight', previewSubtle)}>{f.label}</dt>
              <dd className={cn('m-0 max-w-full truncate font-mono text-subhead leading-tight text-foreground', part === undefined && previewSubtle)}>
                {part ?? '–'}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* Kept while valid (its height holds while cronstrue loads); an invalid expression has no words to show. */}
      {validation.valid ? (
        <p data-slot="cron-editor-description" className="m-0 min-h-[18px] px-1 text-detail text-foreground">{words}</p>
      ) : null}

      {presets && presets.length ? (
        <div data-slot="cron-editor-presets">
          {/* One of N: the preset the expression matches is pressed, and pressing it again keeps it. */}
          <ToggleGroup aria-label="Presets" deselectable={false} disabled={disabled} className="w-auto flex-wrap gap-1.5"
            value={presets.some((p) => p.value === expression.trim()) ? [expression.trim()] : []}
            onValueChange={(next, details) => { if (next[0] !== undefined) set(next[0], details); }}>
            {presets.map((p) => (
              <Toggle key={p.value} value={p.value} variant="secondary" size="sm" className="data-pressed:text-foreground">
                {p.label}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
    </>
  );

  return (
    <div data-slot="cron-editor" className={cn('flex min-w-0 flex-col gap-3 text-footnote', className)} {...rest}>
      {name !== undefined ? <input type="hidden" name={name} value={expression} disabled={disabled} /> : null}
      {/* The same condition as the layout: disabled, the raw editor alone shows the expression. The support check
          runs again once it is enabled. */}
      {plainEnglish ? (
        <NaturalLanguage label={naturalLanguageLabel} current={expression} onUse={set} onSupport={setSupport} onPending={setAnswering} debounceMs={parse?.debounceMs} />
      ) : null}

      {plainEnglish ? (
        // The expression the model chose, always in view, and the raw editor a press away to correct it.
        <Disclosure open={editing} onOpenChange={setEditing} className="shadow-none">
          <div data-slot="cron-editor-expression" aria-busy={answering || undefined} className="flex min-w-0 items-center gap-2 px-1">
            <span className={previewSubtle}>Expression</span>
            <code className={cn('min-w-0 truncate font-mono text-subhead text-foreground transition-opacity duration-spring-snappy ease-spring-snappy', answering && 'opacity-60')}>{empty ? '–' : expression}</code>
            <DisclosureTrigger className="ms-auto w-auto flex-none gap-1 text-footnote font-semibold text-primary">Edit expression</DisclosureTrigger>
          </div>
          <DisclosurePanel hiddenUntilFound={false} className="text-footnote text-foreground">
            <div className="flex flex-col gap-3 pt-1">{raw}</div>
          </DisclosurePanel>
        </Disclosure>
      ) : (
        raw
      )}

      <section data-slot="cron-editor-next" aria-labelledby={nextId} className={cn(previewPanelVariants({ variant }), 'gap-1.5')}>
        <p id={nextId} className={cn('m-0 text-caption font-semibold', previewSubtle)}>Next runs</p>
        {runs && runs.length && runFormat ? (
          <OccurrenceList ordered icon="clock" items={runs.map((r) => ({ key: r.getTime(), label: runFormat.format(r), dateTime: r.toISOString() }))} />
        ) : (
          <p className={cn('m-0', previewSubtle)}>
            {!zoneKnown
              ? `“${zone}” is not a time zone this browser knows.`
              : empty
                ? 'Enter an expression to see when it runs.'
                : !validation.valid
                  ? 'Fix the expression to see when it runs.'
                  : runs === null
                    ? ''
                    : 'This expression never matches a real date (31 February, say).'}
          </p>
        )}
        <ZoneNote zone={zone}>
          {timeZone === undefined ? ' (this device’s time zone)' : ''}. Weekdays and dates follow that zone.
        </ZoneNote>
      </section>
    </div>
  );
}

interface NaturalLanguageProps {
  label: ReactNode;
  /** The expression in the editor now. */
  current: string;
  onUse: (expression: string, details: CronEditorChangeDetails) => void;
  /** Reports whether gpu-cron can run here (null while checking). */
  onSupport: (supported: boolean | null) => void;
  /** Reports whether a newer answer is pending. */
  onPending: (pending: boolean) => void;
  debounceMs?: number;
}

/** The plain-English box: each answer gpu-cron gives for the text becomes the value. Rendered only while gpu-cron may
    run; where it cannot, the raw field's description says why. */
function NaturalLanguage({ label, current, onUse, onSupport, onPending, debounceMs = 0 }: NaturalLanguageProps) {
  const [text, setText] = useState('');
  // How the text being answered was typed: an answer reports it as its own change.
  const typed = useRef<{ event?: Event; source: ChangeSource }>({ source: 'keyboard' });
  const { result, error, supported, parsedText, pending } = useCronParse(text, { debounceMs });
  useEffect(() => onPending(pending), [pending, onPending]);
  useEffect(() => () => onPending(false), [onPending]);
  const answer = result && parsedText === text ? result.expression : null;

  useEffect(() => onSupport(supported), [supported, onSupport]);
  // The newest answer is the value (only answers to what the box says now, so a slow one never lands late).
  useEffect(() => {
    if (answer !== null && answer !== current.trim()) onUse(answer, changeDetails<CronEditorChangeReason>({ reason: 'input-change', ...typed.current }));
  }, [answer]);

  if (supported === false) return null;

  return (
    <div data-slot="cron-editor-natural" data-supported={supported ?? undefined} className="flex flex-col gap-2">
      <Field disabled={supported === null} invalid={error !== null ? true : undefined}>
        <FieldLabel>{label}</FieldLabel>
        <Input value={text} onValueChange={(next, d) => { typed.current = { event: d.event, source: d.source }; setText(next); }} placeholder={supported === null ? 'Checking for WebGPU…' : 'e.g. every weekday at 9am'} autoComplete="off" spellCheck={false} />
        <FieldError>{error ? describeCronError(error) : undefined}</FieldError>
      </Field>
    </div>
  );
}

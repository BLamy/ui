'use client';
import { useEffect, useId, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldDescription, FieldError, TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { CRON_FIELDS, cronProblems, describeCron, isValidTimeZone, localTimeZone, nextCronRuns, validateCron } from '@/lib/cron';
import { describeCronError, useCronParse } from '@/lib/gpu-cron';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ CronEditor — edit a 5-field cron expression with its meaning in view.
   The raw expression is always there: one text field, with each of its five fields (minute, hour, day of month,
   month, day of week) labelled and checked on its own, an English description, preset chips and the next runs in
   any IANA time zone. All of that is local and works everywhere.
   Where the browser has WebGPU, the editor is just a plain-English box ("every weekday at 9am") and the next runs:
   gpu-cron turns the text into an expression on every keystroke and that becomes the value, so the runs (and your
   `onValueChange`) follow what you type. The model always answers, even to nonsense, which is why the next runs stay
   in view: they are how you check it. gpu-cron is WebGPU-only, so without WebGPU (or with `naturalLanguage={false}`)
   the editor is the raw expression instead, with its fields, description and presets.

   <CronEditor value={cron} onValueChange={setCron} timeZone="Europe/Paris" /> ══ */

/** Secondary text: `text-muted-foreground` is below WCAG AA (4.5:1) on the bl-theme's grey surfaces, so the captions
    and notes here use the foreground at 70%. */
const subtleText = 'text-foreground/70';

/** A field error: the message in the foreground color (red text is below AA on grey) with a red icon, so it is
    never color alone. */
function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-start gap-1.5">
      <Icon name="exclamation-circle" size={14} className="mt-[3px] shrink-0 text-destructive" />
      <span>{children}</span>
    </span>
  );
}

export const cronEditorVariants = cva('flex min-w-0 flex-col gap-3 text-footnote', {
  variants: {
    /** `card`: the "understood" row and the next runs sit on filled panels. `plain`: no surface. */
    variant: {
      card: '[&_[data-surface]]:rounded-panel [&_[data-surface]]:bg-secondary [&_[data-surface]]:p-3',
      plain: '[&_[data-surface]]:px-1',
    },
  },
  defaultVariants: { variant: 'card' },
});

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

export interface CronEditorProps extends Omit<ComponentProps<'div'>, 'defaultValue' | 'onChange'>, VariantProps<typeof cronEditorVariants> {
  /** The expression (controlled). */
  value?: string;
  /** The initial expression when uncontrolled. */
  defaultValue?: string;
  /** Called with the new expression on every edit, a preset press, and every answer of the plain-English box. */
  onValueChange?: (expression: string) => void;
  /** Label of the expression field. Default: "Cron expression". */
  label?: ReactNode;
  /** Help text under the expression field. */
  description?: ReactNode;
  /** Form field name for the expression. */
  name?: string;
  /** IANA zone the expression is read in for "Next runs". Default: this device's zone. */
  timeZone?: string;
  /** The moment "Next runs" counts from: a Date, epoch milliseconds or an ISO string. Default: now (read after
      mount, so the server and client render the same HTML, and refreshed every 30 seconds). */
  from?: Date | number | string;
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
  /** Milliseconds the plain-English box waits after typing before asking the model. Default: 0 (every keystroke). */
  debounceMs?: number;
  isDisabled?: boolean;
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
  from,
  nextRunCount = 5,
  presets = CRON_PRESETS,
  naturalLanguage = true,
  naturalLanguageLabel = 'Describe the schedule',
  locale,
  debounceMs,
  isDisabled,
  variant,
  className,
  ...rest
}: CronEditorProps) {
  const [inner, setInner] = useState(defaultValue);
  const expression = value ?? inner;
  const set = (next: string) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  const validation = useMemo(() => validateCron(expression), [expression]);
  const problems = useMemo(() => cronProblems(validation), [validation]);
  const empty = expression.trim() === '';
  const words = useCronDescription(expression);
  const [caretField, setCaretField] = useState<number | null>(null);

  const zone = useMemo(() => timeZone ?? localTimeZone(), [timeZone]);
  const now = useNow(from);
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
  // While the plain-English box can run (or is still checking), it is the only input; without WebGPU, the raw one.
  const [support, setSupport] = useState<boolean | null>(null);
  // Disabled, the editor shows the expression itself (read-only).
  const plainEnglish = naturalLanguage && !isDisabled && support !== false;

  return (
    <div data-slot="cron-editor" className={cn(cronEditorVariants({ variant }), className)} {...rest}>
      {naturalLanguage ? (
        <NaturalLanguage label={naturalLanguageLabel} current={expression} onUse={set} onSupport={setSupport} debounceMs={debounceMs} isDisabled={isDisabled} />
      ) : null}

      {plainEnglish ? null : (
        <>
          <TextField value={expression} onChange={set} name={name} isDisabled={isDisabled} isInvalid={!empty && !validation.valid}>
            <Label variant="field" className={subtleText}>{label}</Label>
            <Input
              className="[font-family:var(--font-mono)]"
              placeholder="0 9 * * 1-5"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onSelect={(e) => setCaretField(fieldAtCaret(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length))}
              onBlur={() => setCaretField(null)}
            />
            <FieldDescription className={subtleText}>{description ?? 'Five fields, separated by spaces.'}</FieldDescription>
            <FieldError className="text-foreground">
              {problems.map((p) => (
                <ErrorLine key={`${p.field}-${p.message}`}>{p.message}</ErrorLine>
              ))}
            </FieldError>
          </TextField>

          <dl data-slot="cron-editor-fields" className="m-0 grid grid-cols-5 gap-1.5">
            {CRON_FIELDS.map((f, i) => {
              const bad = validation.fields[f.name];
              const part = validation.parts[i];
              return (
                <div
                  key={f.name}
                  data-field={f.name}
                  data-active={caretField === i ? '' : undefined}
                  data-invalid={bad ? '' : undefined}
                  className="flex min-w-0 flex-col-reverse items-center justify-end gap-0.5 rounded-ctl bg-secondary px-1 py-1.5 text-center ring-primary data-active:ring-2 data-invalid:ring-2 data-invalid:ring-destructive"
                >
                  <dt className="text-caption2 leading-tight text-foreground/70">{f.label}</dt>
                  <dd className={cn('m-0 max-w-full truncate font-mono text-subhead leading-tight text-foreground', part === undefined && 'text-foreground/70')}>
                    {part ?? '–'}
                  </dd>
                </div>
              );
            })}
          </dl>

          <p data-slot="cron-editor-description" className="m-0 min-h-[18px] px-1 text-detail text-foreground">
            {validation.valid ? words : null}
          </p>

          {presets && presets.length ? (
            <div data-slot="cron-editor-presets" role="group" aria-label="Presets" className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Toggle key={p.value} variant="filled" size="sm" isSelected={expression.trim() === p.value} onChange={() => set(p.value)} isDisabled={isDisabled} className="data-selected:text-foreground">
                  {p.label}
                </Toggle>
              ))}
            </div>
          ) : null}
        </>
      )}

      <section data-slot="cron-editor-next" data-surface="" aria-labelledby={nextId} className="flex flex-col gap-1.5">
        <p id={nextId} className="m-0 text-caption font-semibold text-foreground/70">Next runs</p>
        {runs && runs.length && runFormat ? (
          <ol className="m-0 flex list-none flex-col gap-1 p-0 text-foreground tabular-nums">
            {runs.map((r) => (
              <li key={r.getTime()} className="flex items-center gap-2">
                <Icon name="clock" size={14} className="text-foreground/70" />
                <time dateTime={r.toISOString()}>{runFormat.format(r)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 text-foreground/70">
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
        <p className="m-0 text-caption text-foreground/70">
          Times in {zone}{timeZone === undefined ? ' (this device’s time zone)' : ''}. Weekdays and dates follow that zone.
        </p>
      </section>
    </div>
  );
}

interface NaturalLanguageProps {
  label: ReactNode;
  /** The expression in the editor now. */
  current: string;
  onUse: (expression: string) => void;
  /** Reports whether gpu-cron can run here (null while checking). */
  onSupport: (supported: boolean | null) => void;
  debounceMs?: number;
  isDisabled?: boolean;
}

/** The plain-English box: each answer gpu-cron gives for the text becomes the value. Rendered only while gpu-cron may
    run (and as a note when it cannot). */
function NaturalLanguage({ label, current, onUse, onSupport, debounceMs = 0, isDisabled }: NaturalLanguageProps) {
  const [text, setText] = useState('');
  const { result, error, supported, parsedText } = useCronParse(text, { debounceMs, enabled: !isDisabled });
  const answer = result && parsedText === text ? result.expression : null;

  useEffect(() => onSupport(supported), [supported, onSupport]);
  // The newest answer is the value (only answers to what the box says now, so a slow one never lands late).
  useEffect(() => {
    if (answer !== null && answer !== current.trim()) onUse(answer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer]);

  if (supported === false) {
    return (
      <p data-slot="cron-editor-note" className="m-0 flex items-start gap-1.5 text-foreground/70">
        <Icon name="info" size={14} className="mt-[3px]" />
        <span>Describing a schedule in words needs WebGPU, which this browser does not offer. Type the expression below instead.</span>
      </p>
    );
  }

  return (
    <div data-slot="cron-editor-natural" data-supported={supported ?? undefined} className="flex flex-col gap-2">
      <TextField value={text} onChange={setText} isDisabled={isDisabled || supported === null} isInvalid={error !== null}>
        <Label variant="field" className={subtleText}>{label}</Label>
        <Input placeholder={supported === null && !isDisabled ? 'Checking for WebGPU…' : 'e.g. every weekday at 9am'} autoComplete="off" spellCheck={false} />
        <FieldError className="text-foreground">{error ? <ErrorLine>{describeCronError(error)}</ErrorLine> : null}</FieldError>
      </TextField>
    </div>
  );
}

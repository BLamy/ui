'use client';
import { useMemo, useState, type HTMLAttributes } from 'react';
import { Button } from '@/components/ui/button';
import {
  STRING_PREVIEW_LENGTH, copyTextOf, formatLength, fullLength, hiddenLength, nextShownLength, previewTokens,
  type ValuePreview, type ValueTokenType,
} from '@/lib/object-tree-value';
import { selectableText } from '@/lib/primitives';
import { useCopy } from '@/lib/use-copy';
import { cn } from '@/lib/utils';

/* ══ ObjectValue — a value's one-line preview, tinted by type as DevTools does.
   The value is plain data (`ValuePreview`), so it can come from another process; `previewFromValue` makes one from a
   live value. Long strings and error stacks are truncated at `maxLength`, with Show more and Copy beside them.
   For a whole tree of values, ObjectTree draws its rows with this.
   <ObjectValue value={{ type: 'string', value: 'hello' }} />
   <ObjectValue value={previewFromValue({ a: 1, b: [2, 3] })} /> ══ */

/** The tints share CodeEditor's token colors, so a value and the code next to it read alike. */
const TINTS: Record<ValueTokenType, string> = {
  string: 'bl-tok-string',
  number: 'bl-tok-number',
  keyword: 'bl-tok-keyword',
  nullish: 'text-muted-foreground',
  function: 'bl-tok-function',
  functionMark: 'bl-tok-keyword italic',
  symbol: 'bl-tok-constant',
  regexp: 'bl-tok-operator',
  date: 'bl-tok-type',
  // The code theme's red (AA on the card in both schemes); the system red is 3.5:1 as small text.
  error: 'bl-tok-constant',
  className: 'bl-tok-type',
  key: 'text-muted-foreground',
  punctuation: 'text-muted-foreground',
  muted: 'text-muted-foreground',
  plain: '',
};

/** The kit's inline link, in the caption face; its hit area reaches past the text (24px tall) without moving the
 *  lines. */
const linkButton = cn(
  'relative ms-1.5 align-baseline font-sans text-caption2 font-medium',
  'after:absolute after:-inset-x-1 after:-inset-y-1.5 after:content-[""]',
);

export interface ObjectValueProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: ValuePreview;
  /** Characters of a long string to show at first. Default 100. */
  maxLength?: number;
  /** Quote strings. `false` for the bare text a console shows for a top-level string. Default `true`. */
  quote?: boolean;
  /** Show more and Copy beside a long string or an error's stack. Off in a row of fixed height, as a tree's: the value
   *  is still cut at `maxLength`. Default `true`. */
  actions?: boolean;
  /** Writes the text Copy gives yourself, instead of `navigator.clipboard`: a host with a clipboard of its own. */
  onValueCopy?: (text: string) => void | Promise<void>;
}

export function ObjectValue({ value, maxLength = STRING_PREVIEW_LENGTH, quote, actions = true, onValueCopy, className, style, ...props }: ObjectValueProps) {
  const [shown, setShown] = useState(maxLength);
  const [expanded, setExpanded] = useState(false);
  const { copy, copied } = useCopy({ write: onValueCopy });
  const options = useMemo(() => ({ maxString: actions ? shown : maxLength, quote, expanded }), [actions, shown, maxLength, quote, expanded]);
  const tokens = useMemo(() => previewTokens(value, options), [value, options]);
  const hidden = actions ? hiddenLength(value, shown, expanded) : 0;

  const showMore = () => {
    setExpanded(true);
    setShown((s) => nextShownLength(fullLength(value), s));
  };

  return (
    <span
      data-slot="object-value"
      data-type={value.type}
      className={cn('font-mono text-caption break-words whitespace-pre-wrap', selectableText, className)}
      style={style}
      {...props}
    >
      {tokens.map((token, i) => (
        <span key={i} className={TINTS[token.tint]}>{token.text}</span>
      ))}
      {hidden > 0 ? (
        <>
          <Button variant="link" className={linkButton} onClick={showMore}>Show more ({formatLength(hidden)})</Button>
          <Button variant="link" className={linkButton} onClick={() => void copy(copyTextOf(value))}>{copied ? 'Copied' : 'Copy'}</Button>
        </>
      ) : null}
    </span>
  );
}

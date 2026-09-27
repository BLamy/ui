/* Copy affordances for the docs: a copy button whose glyph swaps to a tick (IconSwap, the ui motion vocabulary),
   and a pill tab strip. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Haptics, IconSwap, springs, useReducedMotion } from '@brett_lamy/ui';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API unavailable (insecure context): fall back to a selection copy.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  Haptics.notification('success');
}

/** `copied` flips true for a moment after `copy()`. */
export function useCopied(ms = 1600) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    await copyText(text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), ms);
  };
  return { copied, copy };
}

export const CopyGlyph = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </svg>
);
export const TickGlyph = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** The copy → tick glyph pair. */
export function CopyIcon({ copied, size }: { copied: boolean; size?: number }) {
  return (
    <IconSwap id={copied ? 'tick' : 'copy'} style={{ color: copied ? 'var(--dk-success)' : undefined }}>
      {copied ? <TickGlyph size={size} /> : <CopyGlyph size={size} />}
    </IconSwap>
  );
}

export function CopyButton({ text, label = 'Copy', className = 'dk-copy' }: { text: string; label?: string; className?: string }) {
  const { copied, copy } = useCopied();
  return (
    <button type="button" className={className} onClick={() => copy(text)} aria-label={copied ? 'Copied' : label} title={copied ? 'Copied' : label}>
      <CopyIcon copied={copied} />
    </button>
  );
}

/** A tab strip with a sliding pill (layoutId spring). */
export function PillTabs<T extends string>({ tabs, value, onChange, id, label }: {
  tabs: readonly { id: T; label: ReactNode }[]; value: T; onChange: (id: T) => void; id: string; label: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="dk-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className="dk-tab"
          onClick={() => { if (t.id !== value) { Haptics.selection(); onChange(t.id); } }}>
          {t.id === value ? (
            <motion.span layoutId={`${id}-pill`} className="dk-tab-pill" transition={reduced ? { duration: 0 } : springs.snappy} />
          ) : null}
          <span style={{ position: 'relative' }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

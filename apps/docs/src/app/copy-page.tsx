/* "Copy page ▾" — copies the page as Markdown (tick confirmation), with a menu to view the Markdown or open it
   in ChatGPT / Claude. Motion: IconSwap for copy → tick, Chevron for the caret, a snappy spring for the menu. */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AnthropicGlyph, Chevron, Haptics, OpenAIGlyph, springs, fades, useReducedMotion } from '@brett_lamy/ui';
import { CopyIcon, useCopied } from './copy';
import { pageMarkdown, pageMdPath } from './page-markdown';
import { SITE_URL } from './registry';

const MdGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M6 15V9l2.5 3L11 9v6M15.5 9v6m0 0l-2-2m2 2l2-2" /></svg>
);
const ExternalGlyph = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);

/** The page's Markdown URL: md/<page>.md from the build (the dev server serves it too). */
const mdUrl = (id: string) => `${import.meta.env.BASE_URL}${pageMdPath(id)}`;
const askPrompt = (id: string) => `Read ${SITE_URL}/${pageMdPath(id)}, I want to ask questions about it.`;

export function CopyPage({ page }: { page: string }) {
  const { copied, copy } = useCopied();
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => setOpen(false), [page]);

  const items = [
    { id: 'copy', icon: <CopyIcon copied={false} />, label: 'Copy as Markdown', hint: 'Copy this page for LLMs', run: () => copy(pageMarkdown(page)) },
    { id: 'view', icon: <MdGlyph />, label: 'View as Markdown', hint: 'Open the page as plain text', href: mdUrl(page) },
    { id: 'gpt', icon: <OpenAIGlyph size={15} />, label: 'Open in ChatGPT', hint: 'Ask questions about this page', href: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(askPrompt(page))}` },
    { id: 'claude', icon: <AnthropicGlyph size={14} />, label: 'Open in Claude', hint: 'Ask questions about this page', href: `https://claude.ai/new?q=${encodeURIComponent(askPrompt(page))}` },
  ];

  return (
    <div ref={root} className="dk-copypage">
      <button type="button" className="dk-copypage-main" onClick={() => copy(pageMarkdown(page))} aria-label="Copy page as Markdown">
        <CopyIcon copied={copied} size={13} />
        <span>{copied ? 'Copied' : 'Copy page'}</span>
      </button>
      <button type="button" className="dk-copypage-more" aria-label="More page actions" aria-haspopup="menu" aria-expanded={open}
        onClick={() => { Haptics.selection(); setOpen((o) => !o); }}>
        <Chevron direction={open ? 'up' : 'down'} size={12} sw={2.6} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            className="dk-menu"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: reduced ? { duration: 0.1 } : { ...springs.snappy, opacity: fades.in } }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.97, transition: fades.out }}
            style={{ transformOrigin: 'top right' }}
          >
            {items.map((it) => {
              const body = (
                <>
                  <span className="dk-menu-icon">{it.icon}</span>
                  <span className="dk-menu-text">
                    <span className="dk-menu-label">{it.label}{it.href ? <ExternalGlyph /> : null}</span>
                    <span className="dk-menu-hint">{it.hint}</span>
                  </span>
                </>
              );
              return it.href ? (
                <a key={it.id} role="menuitem" className="dk-menu-item" href={it.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>{body}</a>
              ) : (
                <button key={it.id} type="button" role="menuitem" className="dk-menu-item" onClick={() => { it.run?.(); setOpen(false); }}>{body}</button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

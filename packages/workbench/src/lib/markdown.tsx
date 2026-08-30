import * as React from 'react';
import { GitbookStreamdown } from '@brett_lamy/docstream';
import '@brett_lamy/docstream/styles.css';
import { cn } from './util';

/* ══ MarkdownView — Docstream-backed GitBook markdown for docs and chat ══ */
function fbInline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let k = 0;
  const rx = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t[0] === '`') out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('**')) out.push(<strong key={k++}>{fbInline(t.slice(2, -2))}</strong>);
    else if (t.startsWith('~~')) out.push(<s key={k++}>{t.slice(2, -2)}</s>);
    else if (t[0] === '*') out.push(<em key={k++}>{fbInline(t.slice(1, -1))}</em>);
    else {
      const mm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm)
        out.push(
          <a key={k++} href={mm[2]} target="_blank" rel="noreferrer">
            {fbInline(mm[1])}
          </a>
        );
    }
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/* tiny JSX/TS highlighter for static code fences */
const HLC = { kw: '#C792EA', str: '#A5D6A7', num: '#F78C6C', com: '#6B6B78', fn: '#82AAFF', tag: '#F07178', attr: '#FFCB6B', punc: '#89DDFF', id: '#D8D8E2' };
const HL_KW = new Set(
  'import export from const let var function return if else for while switch case default new class extends super this typeof instanceof in of try catch finally throw await async yield break continue null undefined true false void delete static get set'.split(' ')
);
export function hlTokens(src: string): React.ReactNode[] {
  const rx = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(<\/?)([A-Za-z][\w.]*)|([A-Za-z_$][\w$]*)|([{}()[\];,.<>=+\-*/!&|?:]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  const push = (txt: string, color?: string) =>
    out.push(
      color ? (
        <span key={k++} style={{ color }}>
          {txt}
        </span>
      ) : (
        txt
      )
    );
  while ((m = rx.exec(src))) {
    if (m.index > last) push(src.slice(last, m.index));
    if (m[1] || m[2]) push(m[0], HLC.com);
    else if (m[3]) push(m[0], HLC.str);
    else if (m[4]) push(m[0], HLC.num);
    else if (m[5]) {
      push(m[5], HLC.punc);
      push(m[6], m[6][0] === m[6][0].toUpperCase() ? HLC.attr : HLC.tag);
    } else if (m[7]) {
      const w = m[7];
      const next = src.slice(rx.lastIndex).match(/^\s*\(/);
      push(w, HL_KW.has(w) ? HLC.kw : next ? HLC.fn : /^[A-Z]/.test(w) ? HLC.attr : HLC.id);
    } else if (m[8]) push(m[0], HLC.punc);
    last = rx.lastIndex;
  }
  if (last < src.length) push(src.slice(last));
  return out;
}

export function HlPre({ code, lang }: { code: string; lang?: string }) {
  const plain = lang && !/^(jsx?|tsx?|js|ts|javascript|typescript|html|xml|svg)$/i.test(lang);
  return (
    <pre data-lang={lang}>
      <code>{plain ? code : hlTokens(code)}</code>
    </pre>
  );
}

export function FbMd({ md }: { md?: string }) {
  const lines = (md || '').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const L = lines[i];
    if (/^```/.test(L)) {
      const lang = L.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push(<HlPre key={k++} code={buf.join('\n')} lang={lang} />);
    } else if (/^#{1,4} /.test(L)) {
      const hm = L.match(/^#+/);
      const n = hm ? hm[0].length : 1;
      const T = ['h1', 'h2', 'h3', 'h4'][n - 1];
      blocks.push(React.createElement(T, { key: k++ }, fbInline(L.replace(/^#+ /, ''))));
      i++;
    } else if (/^\s*([-*]|\d+\.) /.test(L)) {
      const ord = /^\s*\d+\./.test(L);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i]))
        items.push(lines[i++].replace(/^\s*([-*]|\d+\.) /, ''));
      blocks.push(
        React.createElement(
          ord ? 'ol' : 'ul',
          { key: k++ },
          items.map((t, j) => <li key={j}>{fbInline(t)}</li>)
        )
      );
    } else if (/^\|/.test(L)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i]))
        rows.push(lines[i++].replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      blocks.push(
        <table key={k++}>
          <thead>
            <tr>
              {body[0].map((c, j) => (
                <th key={j}>{fbInline(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.slice(1).map((r, ri) => (
              <tr key={ri}>
                {r.map((c, j) => (
                  <td key={j}>{fbInline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else if (/^\s*>/.test(L)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*> ?/, ''));
      blocks.push(
        <blockquote key={k++}>
          {buf.map((t, j) => (
            <p key={j}>{fbInline(t)}</p>
          ))}
        </blockquote>
      );
    } else if (/^\s*(---|\*\*\*)\s*$/.test(L)) {
      blocks.push(<hr key={k++} />);
      i++;
    } else if (!L.trim()) i++;
    else {
      const buf: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(```|#{1,4} |\||\s*>|\s*([-*]|\d+\.) )/.test(lines[i]) &&
        !/^\s*(---|\*\*\*)\s*$/.test(lines[i])
      )
        buf.push(lines[i++]);
      blocks.push(<p key={k++}>{fbInline(buf.join(' '))}</p>);
    }
  }
  return <React.Fragment>{blocks}</React.Fragment>;
}

export interface MarkdownViewProps {
  markdown?: string;
  /** Passes streaming state through to Docstream for accessible streaming markup. */
  streaming?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function MarkdownView({ markdown, streaming, className, style }: MarkdownViewProps) {
  return (
    <div data-slot="markdown-view" data-renderer="docstream" className={cn('wb-md', className)} style={style}>
      <GitbookStreamdown markdown={markdown ?? ''} isStreaming={streaming} />
    </div>
  );
}

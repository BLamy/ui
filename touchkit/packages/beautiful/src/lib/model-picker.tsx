/* 32 — ModelPicker: provider rail + search + favorites, ⌘N quick-select */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BIcon, C, Kbd, P, card, cn, mut, mut3, vib } from './base';

export const PROV_TONE: Record<string, string> = {
  anthropic: '#D97757',
  openai: '#EDEDF2',
  google: '#4285F4',
  opencode: '#B8B8C4',
  deepseek: '#5E7CE2',
};
/* real vector marks: OpenAI from Bootstrap Icons (MIT); Gemini four-point spark; Anthropic slab-A */
export const PROV_ICON: Record<string, { vb: string; d: string }> = {
  openai: {
    vb: '0 0 16 16',
    d: 'M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934A4.1 4.1 0 0 0 8.423.2 4.15 4.15 0 0 0 6.305.086a4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679A4 4 0 0 0 .554 4.72a3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94a3.02 3.02 0 0 1 1.569-1.325v3.827a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.32a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a2.98 2.98 0 0 1-.46 5.383v-3.83a.51.51 0 0 0-.258-.457zm1.36-2.02-.095-.056-3.228-1.858a.53.53 0 0 0-.527 0L6.253 6.146V4.591a.05.05 0 0 1 .022-.041l3.27-1.861c1.456-.83 3.316-.335 4.15 1.106.36.607.487 1.322.353 2.019m-8.716 2.836-1.367-.777a.05.05 0 0 1-.025-.036V4.117a2.99 2.99 0 0 1 4.9-2.286l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.759-1 1.762 1v2l-1.755 1-1.762-1z',
  },
  google: { vb: '0 0 24 24', d: 'M12 1c.6 6.1 4.8 10.3 11 11-6.2.7-10.4 4.9-11 11-.6-6.1-4.8-10.3-11-11 6.2-.7 10.4-4.9 11-11z' },
  anthropic: { vb: '0 0 24 24', d: 'M13.79 4.6h-3.66L3.5 19.4h3.73l1.36-3.42h6.75l1.36 3.42h3.8L13.79 4.6zm-4 8.53l2.2-5.53 2.2 5.53h-4.4z' },
};

export interface ProvGlyphProps {
  p?: string;
  size?: number;
  active?: boolean;
}
export function ProvGlyph({ p, size = 20, active }: ProvGlyphProps) {
  const ic = p ? PROV_ICON[p] : undefined;
  if (ic)
    return (
      <span
        data-slot="prov-glyph"
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: active ? 'var(--wb-fill2)' : 'transparent',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg width={size * 0.78} height={size * 0.78} viewBox={ic.vb} fill={(p && PROV_TONE[p]) || 'currentColor'} xmlns="http://www.w3.org/2000/svg">
          <path d={ic.d} />
        </svg>
      </span>
    );
  return (
    <span
      data-slot="prov-glyph"
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: active ? 'var(--wb-fill2)' : 'var(--wb-fill)',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.5,
        fontWeight: 800,
        color: (p && PROV_TONE[p]) || mut,
        fontFamily: BFONT,
        textTransform: 'uppercase',
      }}
    >
      {(p || '?')[0]}
    </span>
  );
}

export interface PickerModel {
  id: string;
  name: string;
  provider: string;
  source?: string;
}
export interface ModelPickerProps {
  models?: PickerModel[];
  value?: string | null;
  onChange?: (id: string) => void;
  favorites?: string[];
  up?: boolean;
  style?: CSSProperties;
  className?: string;
}
export function ModelPicker({ models = [], value, onChange, favorites = [], up, style, className }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rail, setRail] = useState<string | null>(null); /* null = all, '★' = favorites, else provider id */
  const [favs, setFavs] = useState(favorites);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [open]);
  const hits = models.filter(
    (m) =>
      (!q || m.name.toLowerCase().includes(q.toLowerCase())) &&
      (rail === '★' ? favs.includes(m.id) : !rail || m.provider === rail)
  );
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      const n = parseInt(e.key, 10);
      if ((e.metaKey || e.ctrlKey) && n >= 1 && n <= Math.min(hits.length, 9)) {
        e.preventDefault();
        onChange && onChange(hits[n - 1].id);
        setOpen(false);
        vib([8]);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, hits, onChange]);
  const cur = models.find((m) => m.id === value);
  const providers = [...new Set(models.map((m) => m.provider))];
  const railBtn = (id: string | null, node: ReactNode, label?: string) => (
    <button
      key={id || 'all'}
      onClick={() => {
        setRail(rail === id ? null : id);
        vib([4]);
      }}
      aria-label={label}
      style={{
        position: 'relative',
        border: 0,
        background: 'none',
        cursor: 'pointer',
        padding: '7px 0',
        display: 'grid',
        placeItems: 'center',
        width: '100%',
      }}
    >
      {rail === id && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 2.5,
            height: 18,
            borderRadius: 2,
            background: C.blue,
          }}
        />
      )}
      {node}
    </button>
  );
  return (
    <div data-slot="model-picker" ref={ref} className={cn(className)} style={{ position: 'relative', display: 'inline-block', fontFamily: BFONT, ...style }}>
      <button
        className="bui-hl"
        onClick={() => {
          setOpen((o) => !o);
          vib([5]);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          ...card({ padding: '6px 11px', borderRadius: 999 }),
          color: 'var(--wb-label)',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {cur && <ProvGlyph p={cur.provider} size={16} />}
        {cur ? cur.name : 'Pick a model'}
        <span style={{ color: mut3, display: 'grid' }}>
          <BIcon d={P['chevD']} size={12} />
        </span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            ...(up ? { bottom: '100%', marginBottom: 8 } : { top: '100%', marginTop: 8 }),
            zIndex: 40,
            display: 'flex',
            width: 340,
            height: 300,
            ...card({ background: '#141419', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }),
            animation: 'bui-in .18s ' + BEASE,
          }}
        >
          <div
            className="wb-scroll"
            style={{ width: 44, flexShrink: 0, borderRight: '1px solid var(--wb-sep)', overflowY: 'auto', padding: '6px 0' }}
          >
            {railBtn('★', <span style={{ color: rail === '★' ? '#fff' : mut3, fontSize: 15 }}>★</span>, 'Favorites')}
            {providers.map((p) => railBtn(p, <ProvGlyph p={p} active={rail === p} />, p))}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px', borderBottom: '2px solid ' + C.blue }}
            >
              <span style={{ color: mut3, display: 'grid' }}>
                <BIcon d={P['search']} size={14} />
              </span>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search models…"
                style={{
                  border: 0,
                  background: 'none',
                  outline: 'none',
                  color: 'var(--wb-label)',
                  fontSize: 13,
                  fontFamily: BFONT,
                  flex: 1,
                  minWidth: 0,
                }}
              />
            </div>
            <div className="wb-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 6px' }}>
              {hits.map((m, i) => (
                <div
                  key={m.id}
                  className="bui-hl"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 9,
                    padding: '7px 8px',
                    background: m.id === value ? 'var(--wb-fill)' : 'transparent',
                  }}
                >
                  <button
                    onClick={() => {
                      onChange && onChange(m.id);
                      setOpen(false);
                      vib([8]);
                    }}
                    style={{ flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: BFONT }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--wb-label)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {m.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: mut3, marginTop: 1 }}>
                      <ProvGlyph p={m.provider} size={12} />
                      {m.source || m.provider}
                    </div>
                  </button>
                  {i < 9 && <Kbd>⌘{i + 1}</Kbd>}
                  <button
                    onClick={() => {
                      vib([5]);
                      setFavs((f) => (f.includes(m.id) ? f.filter((x) => x !== m.id) : [...f, m.id]));
                    }}
                    aria-label="Favorite"
                    style={{
                      border: 0,
                      background: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      fontSize: 13,
                      color: favs.includes(m.id) ? C.orange : mut3,
                      lineHeight: 1,
                    }}
                  >
                    {favs.includes(m.id) ? '★' : '☆'}
                  </button>
                </div>
              ))}
              {!hits.length && (
                <div style={{ padding: '26px 0', textAlign: 'center', fontSize: 12, color: mut3 }}>
                  {rail === '★' ? 'No favorites yet — star a model.' : 'No models match.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

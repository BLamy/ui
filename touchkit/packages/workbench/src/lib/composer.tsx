import * as React from 'react';
import { useState, useRef } from 'react';
import { cn, MONO, WFONT } from './util';
import { vib, tick } from './haptics';
import { WIcon, type WIconName } from './icons';

/* ══ Composer ══ */
const MODELS = ['Claude Opus 4.7', 'Claude Sonnet 4.9', 'Claude Haiku 4.5'];
const EFFORTS = ['Extra High', 'High', 'Medium'];
const ACCESS = ['Full access', 'Read only', 'Ask first'];

export interface PillProps {
  icon?: WIconName;
  label: string;
  onPress?: () => void;
  tint?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function Pill({ icon, label, onPress, tint, className, style }: PillProps) {
  return (
    <button
      type="button"
      className={cn('wb-btn wb-hl', className)}
      onClick={onPress}
      title={label}
      data-slot="composer-pill"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        border: 0,
        background: 'none',
        color: tint ? 'var(--wb-tint)' : 'var(--wb-label2)',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        borderRadius: 7,
        padding: '5px 7px',
        ...style,
      }}
    >
      {icon ? <WIcon name={icon} size={13.5} sw={2} /> : null}
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <WIcon name="chevD" size={11} sw={2.4} style={{ opacity: 0.6 }} />
    </button>
  );
}

interface Att {
  id: string;
  src: string;
}

/* AnnotateLightbox — click a pasted image: an annotation canvas overlays it; Save rasterizes image + strokes
   into one flattened PNG. Pass a drawing surface (e.g. PencilCanvas from @touchkit/pencilkit) as `canvas`. */
export interface AnnotateLightboxProps {
  src: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  canvas?: React.ReactNode;
}
export function AnnotateLightbox({ src, onClose, onSave, canvas }: AnnotateLightboxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const save = () => {
    const img = imgRef.current,
      box = boxRef.current;
    if (!img || !box) return onClose();
    const w = img.clientWidth,
      h = img.clientHeight,
      sc = 2;
    const cv = document.createElement('canvas');
    cv.width = w * sc;
    cv.height = h * sc;
    const ctx = cv.getContext('2d');
    if (!ctx) return onClose();
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const fin = () => {
      vib([12]);
      onSave(cv.toDataURL('image/png'));
    };
    const svg = box.querySelector('svg');
    if (!svg) return fin();
    const cl = svg.cloneNode(true) as SVGElement;
    cl.setAttribute('width', String(w));
    cl.setAttribute('height', String(h));
    cl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const im = new Image();
    im.onload = () => {
      ctx.drawImage(im, 0, 0, cv.width, cv.height);
      fin();
    };
    im.onerror = fin;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl));
  };
  const btn = (label: string, primary: boolean, onPress: () => void) => (
    <button
      type="button"
      onClick={onPress}
      style={{
        border: primary ? 0 : '1px solid rgba(255,255,255,.2)',
        borderRadius: 9,
        background: primary ? 'var(--wb-tint, #0A84FF)' : 'none',
        color: '#fff',
        fontSize: 12.5,
        fontWeight: 650,
        padding: '7px 14px',
        cursor: 'pointer',
        fontFamily: WFONT,
      }}
    >
      {label}
    </button>
  );
  return (
    <div data-slot="annotate-lightbox" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.74)', display: 'grid', placeItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 650, color: '#EDEDF2', flex: 1, fontFamily: WFONT }}>
            Annotate — PencilKit strokes flatten into the image on save
          </span>
          {btn('Cancel', false, onClose)}
          {btn('Save annotation', true, save)}
        </div>
        <div
          ref={boxRef}
          style={
            {
              position: 'relative',
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,.14)',
              background: '#0C0C10',
              '--tk-card': '#1C1C23',
              '--tk-sep': 'rgba(255,255,255,.12)',
              '--tk-label': '#EDEDF2',
              '--tk-label2': 'rgba(235,235,245,.6)',
              '--tk-label3': 'rgba(235,235,245,.35)',
              '--tk-fill': 'rgba(255,255,255,.07)',
              '--tk-fill2': 'rgba(255,255,255,.14)',
              '--tk-tint': 'var(--wb-tint, #0A84FF)',
            } as React.CSSProperties
          }
        >
          <img ref={imgRef} src={src} alt="" style={{ display: 'block', maxWidth: '86vw', maxHeight: '68vh', minWidth: 340, minHeight: 240, objectFit: 'contain' }} />
          {canvas ?? (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#9C9CA6', fontSize: 12.5, fontFamily: WFONT }}>
              loading PencilKit…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ComposerProps {
  onSend: (text: string, imgs?: string[]) => void;
  streaming?: boolean;
  onStop?: () => void;
  autoFocus?: boolean;
  wide?: boolean;
  /** optional replacement for the fallback model Pill (e.g. Beautiful UI's ModelPicker) */
  modelPicker?: React.ReactNode;
  /** optional drawing surface passed through to the AnnotateLightbox */
  annotateCanvas?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function Composer({ onSend, streaming, onStop, autoFocus, wide, modelPicker, annotateCanvas, className, style }: ComposerProps) {
  const [v, setV] = useState('');
  const [mi, setMi] = useState(0),
    [ei, setEi] = useState(0),
    [ai, setAi] = useState(0);
  const [atts, setAtts] = useState<Att[]>([]);
  const [anno, setAnno] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(190, el.scrollHeight) + 'px';
  };
  const can = !!(v.trim() || atts.length);
  const send = () => {
    if (!can || streaming) return;
    vib([8]);
    const t = v.trim(),
      imgs = atts.map((a) => a.src);
    setV('');
    setAtts([]);
    if (ta.current) {
      ta.current.style.height = 'auto';
    }
    onSend(t, imgs);
  };
  const paste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    let got = false;
    for (const it of Array.from(items))
      if (it.type && it.type.indexOf('image/') === 0) {
        const f = it.getAsFile();
        if (!f) continue;
        got = true;
        const rd = new FileReader();
        rd.onload = () => {
          vib([8]);
          setAtts((a) => [...a, { id: 'att' + Date.now() + Math.random(), src: rd.result as string }]);
        };
        rd.readAsDataURL(f);
      }
    if (got) e.preventDefault();
  };
  const annoAtt = anno ? atts.find((a) => a.id === anno) : null;
  return (
    <div data-slot="composer" className={cn(className)} style={{ width: '100%', boxSizing: 'border-box', ...style }}>
      <div style={{ background: 'var(--wb-card)', border: '1px solid var(--wb-sep)', borderRadius: 15, boxShadow: '0 6px 24px rgba(0,0,0,.28)' }}>
        {atts.length ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 12px 0' }}>
            {atts.map((a) => (
              <div key={a.id} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    tick();
                    setAnno(a.id);
                  }}
                  title="Annotate with PencilKit"
                  style={{ display: 'block', padding: 0, border: '1px solid var(--wb-sep)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#0C0C10' }}
                >
                  <img src={a.src} alt="pasted attachment" style={{ display: 'block', height: 58, maxWidth: 130, objectFit: 'cover' }} />
                </button>
                <span
                  style={{ position: 'absolute', left: 4, bottom: 4, display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 6, background: 'rgba(0,0,0,.55)', color: '#fff', pointerEvents: 'none' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 4l6 6-10 10H4v-6z" />
                  </svg>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    tick();
                    setAtts((x) => x.filter((y) => y.id !== a.id));
                  }}
                  aria-label="Remove attachment"
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '1px solid var(--wb-sep)',
                    background: '#26262E',
                    color: 'var(--wb-label2)',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 0,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <textarea
          ref={ta}
          value={v}
          rows={wide ? 3 : 1}
          autoFocus={autoFocus}
          aria-label="Message"
          placeholder="Ask anything — @ files, / commands, paste images"
          onChange={(e) => {
            setV(e.target.value);
            grow(e.target);
          }}
          onPaste={paste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            border: 0,
            outline: 'none',
            background: 'none',
            resize: 'none',
            color: 'var(--wb-label)',
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.5,
            padding: '12px 14px 4px',
            minHeight: wide ? 64 : 38,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 8px 8px', flexWrap: 'wrap' }}>
          {modelPicker ?? (
            <Pill
              icon="spark"
              label={MODELS[mi]}
              tint
              onPress={() => {
                setMi((i) => (i + 1) % MODELS.length);
                tick();
              }}
            />
          )}
          <Pill
            label={EFFORTS[ei]}
            onPress={() => {
              setEi((i) => (i + 1) % EFFORTS.length);
              tick();
            }}
          />
          <Pill
            icon="lock"
            label={ACCESS[ai]}
            onPress={() => {
              setAi((i) => (i + 1) % ACCESS.length);
              tick();
            }}
          />
          <span style={{ flex: 1 }} />
          {streaming ? (
            <button
              type="button"
              className="wb-btn"
              onClick={onStop}
              aria-label="Stop"
              style={{ position: 'relative', width: 30, height: 30, border: 0, background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--wb-label)' }}
            >
              <svg width="30" height="30" viewBox="0 0 30 30" style={{ position: 'absolute', inset: 0, animation: 'wbSpin 1s linear infinite' }}>
                <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--wb-fill2)" strokeWidth="2.5" />
                <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--wb-tint)" strokeWidth="2.5" strokeDasharray="24 55" strokeLinecap="round" />
              </svg>
              <WIcon name="stop" size={12} sw={2.4} />
            </button>
          ) : (
            <button
              type="button"
              className="wb-btn"
              onClick={send}
              aria-label="Send"
              disabled={!can}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: 0,
                background: 'var(--wb-tint)',
                color: '#fff',
                cursor: can ? 'pointer' : 'default',
                display: 'grid',
                placeItems: 'center',
                opacity: can ? 1 : 0.35,
                transition: 'opacity .15s',
              }}
            >
              <WIcon name="up" size={16} sw={2.4} />
            </button>
          )}
        </div>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--wb-fill)', borderRadius: 9, padding: '6px 11px', margin: '6px 8px 0', fontSize: 12, color: 'var(--wb-label2)' }}
      >
        <WIcon name="folder" size={13.5} sw={1.9} />
        <span style={{ flex: 1 }}>Local checkout</span>
        <WIcon name="branch" size={13.5} sw={1.9} />
        <span style={{ fontFamily: MONO, fontSize: 11.5 }}>main</span>
        <WIcon name="chevD" size={11} sw={2.4} style={{ opacity: 0.6 }} />
      </div>
      {annoAtt ? (
        <AnnotateLightbox
          src={annoAtt.src}
          canvas={annotateCanvas}
          onClose={() => setAnno(null)}
          onSave={(d) => {
            setAtts((x) => x.map((y) => (y.id === anno ? { ...y, src: d } : y)));
            setAnno(null);
          }}
        />
      ) : null}
    </div>
  );
}

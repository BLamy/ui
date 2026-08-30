/* 24 — Toast: sonner-style stack — newest in front, older toasts peek behind, hover fans the
   stack out; timers pause on hover */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BIcon, C, P, card, cn, mut, mut3, vib } from './base';

export type ToastTone = 'info' | 'success' | 'error';
export interface ToastOptions {
  tone?: ToastTone;
  title?: ReactNode;
  detail?: ReactNode;
  duration?: number;
}
interface ToastRecord extends ToastOptions {
  id: number;
  dur: number;
}
export interface ToastContextValue {
  push: (t: ToastOptions) => number;
  dismiss: (id: number) => void;
}
export const ToastCtx = createContext<ToastContextValue | null>(null);
export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error('useToast must be used inside <ToastProvider>');
  return c;
}

export interface ToastProviderProps {
  children?: ReactNode;
  max?: number;
  style?: CSSProperties;
  className?: string;
}
export function ToastProvider({ children, max = 4, style, className }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [hover, setHover] = useState(false);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const dismiss = (id: number) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((x) => x.filter((y) => y.id !== id));
  };
  const arm = (id: number, ms: number) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => dismiss(id), ms);
  };
  const push = (t: ToastOptions) => {
    const id = Date.now() + Math.random();
    vib([8]);
    setToasts((x) => [...x.slice(-(max - 1)), { id, dur: t.duration || 4200, ...t }]);
    arm(id, t.duration || 4200);
    return id;
  };
  useEffect(() => {
    const T = timers.current;
    return () => Object.keys(T).forEach((k) => clearTimeout(T[+k]));
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hover) Object.keys(timers.current).forEach((k) => clearTimeout(timers.current[+k]));
    else toasts.forEach((t) => arm(t.id, t.dur));
  }, [hover]);
  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      <div data-slot="toast-provider" className={cn(className)} style={{ position: 'relative', height: '100%', ...style }}>
        {children}
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 50, width: 272, height: 0 }}
        >
          {toasts.map((t, i) => {
            const off = toasts.length - 1 - i;
            const y = hover ? -(off * 74) : -(off * 14);
            return (
              <div
                key={t.id}
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  transform: 'translateY(' + y + 'px) scale(' + (hover ? 1 : 1 - off * 0.06) + ')',
                  transformOrigin: 'bottom right',
                  opacity: !hover && off > 2 ? 0 : 1,
                  zIndex: 20 - off,
                  transition: 'transform .4s ' + BEASE + ', opacity .3s',
                }}
              >
                <BUIToast {...t} onDismiss={() => dismiss(t.id)} />
              </div>
            );
          })}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

export interface BUIToastProps {
  tone?: ToastTone;
  title?: ReactNode;
  detail?: ReactNode;
  onDismiss?: () => void;
}
export function BUIToast({ tone = 'info', title, detail, onDismiss }: BUIToastProps) {
  const tc = tone === 'success' ? C.green : tone === 'error' ? C.red : C.blue;
  const ic = tone === 'success' ? P['check'] : tone === 'error' ? P['x'] : P['spark'];
  return (
    <div
      data-slot="toast"
      style={{
        ...card({ padding: '10px 12px', background: '#17171D', boxShadow: '0 12px 32px rgba(0,0,0,.5)' }),
        display: 'flex',
        gap: 9,
        alignItems: 'flex-start',
        boxSizing: 'border-box',
        animation: 'bui-in .25s ' + BEASE,
      }}
    >
      <span style={{ color: tc, display: 'grid', marginTop: 1 }}>
        <BIcon d={ic} size={13} sw={2.4} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 650,
            color: 'var(--wb-label)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        {detail && (
          <div
            style={{
              fontSize: 11.5,
              color: mut,
              marginTop: 2,
              lineHeight: 1.45,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {detail}
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ border: 0, background: 'none', color: mut3, cursor: 'pointer', padding: 2, display: 'grid' }}
      >
        <BIcon d={P['x']} size={11} sw={2.2} />
      </button>
    </div>
  );
}

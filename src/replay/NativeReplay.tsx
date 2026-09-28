/* The rrweb player. Loaded on demand by ReplayPreview, so pages that only embed Loop QA
   iframes (the markdown `{% embed %}` case) never download rrweb or its stylesheet. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventType, Replayer } from 'rrweb';
import type { eventWithTime } from 'rrweb';
import { sanitizeReplayEvent } from './sanitize';
import 'rrweb/dist/style.css';

const DEFAULT_SPEEDS = [0.5, 1, 2, 4, 8];
const SKIP_IDLE_THRESHOLD_MS = 5_000;

export default function NativeReplay({
  events,
  autoplay = false,
  loop = false,
  speeds = DEFAULT_SPEEDS,
}: {
  events: eventWithTime[];
  autoplay?: boolean;
  loop?: boolean;
  speeds?: number[];
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const fedCountRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const autoplayRef = useRef(autoplay);

  const prepared = useMemo(
    () => events.map((event) => sanitizeReplayEvent(event)).sort((a, b) => a.timestamp - b.timestamp),
    [events],
  );
  const hasSnapshot = prepared.some((event) => event.type === EventType.FullSnapshot);

  useEffect(() => {
    if (replayerRef.current && prepared.length < fedCountRef.current) {
      try {
        replayerRef.current.destroy();
      } catch {
        // Ignore stale player teardown.
      }
      replayerRef.current = null;
      fedCountRef.current = 0;
    }
    if (!hasSnapshot || !playerRef.current) return;

    if (!replayerRef.current) {
      const replayer = new Replayer(prepared, {
        root: playerRef.current,
        liveMode: false,
        speed: speedRef.current,
        skipInactive: true,
        inactivePeriodThreshold: SKIP_IDLE_THRESHOLD_MS,
        mouseTail: false,
        showWarning: false,
      });
      replayer.on('resize', (payload) => {
        const size = payload as { width?: number; height?: number };
        if (size.width && size.height) setDims({ w: size.width, h: size.height });
      });
      replayer.on('finish', () => {
        if (loopRef.current) {
          replayer.play(0);
          setPlaying(true);
        } else {
          setPlaying(false);
        }
      });
      replayer.pause(0);
      replayerRef.current = replayer;
      fedCountRef.current = prepared.length;
      if (autoplayRef.current) {
        replayer.play(0);
        setPlaying(true);
      }
    } else if (prepared.length > fedCountRef.current) {
      for (let i = fedCountRef.current; i < prepared.length; i++) {
        replayerRef.current.addEvent(prepared[i]!);
      }
      fedCountRef.current = prepared.length;
    }
  }, [hasSnapshot, prepared]);

  useEffect(
    () => () => {
      try {
        replayerRef.current?.destroy();
      } catch {
        // Ignore unmount teardown errors from rrweb.
      }
      replayerRef.current = null;
      fedCountRef.current = 0;
    },
    [],
  );

  useEffect(() => {
    speedRef.current = speed;
    replayerRef.current?.setConfig({ speed });
  }, [speed]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  const recalcScale = useCallback(() => {
    if (!dims || !stageRef.current || dims.w <= 0) return;
    setScale(Math.min(1, stageRef.current.clientWidth / dims.w));
  }, [dims]);

  useEffect(() => {
    recalcScale();
    window.addEventListener('resize', recalcScale);
    return () => window.removeEventListener('resize', recalcScale);
  }, [recalcScale]);

  useEffect(() => {
    if (!hasSnapshot) return;
    const interval = window.setInterval(() => {
      const replayer = replayerRef.current;
      if (!replayer) return;
      try {
        const total = replayer.getMetaData().totalTime;
        const current = Math.max(0, Math.min(replayer.getCurrentTime(), total));
        setTotalTime(total);
        if (scrubbing === null) setCurrentTime(current);
      } catch {
        // rrweb can briefly be unready while a full snapshot is applied.
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [hasSnapshot, scrubbing]);

  const seek = useCallback(
    (value: number) => {
      const replayer = replayerRef.current;
      if (!replayer) return;
      const next = Math.max(0, Math.min(value, totalTime));
      if (playing) replayer.play(next);
      else replayer.pause(next);
      setCurrentTime(next);
    },
    [playing, totalTime],
  );

  const toggle = () => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    if (playing) {
      replayer.pause();
      setPlaying(false);
      return;
    }
    let offset = currentTime;
    try {
      if (offset >= replayer.getMetaData().totalTime - 1) offset = 0;
    } catch {
      offset = 0;
    }
    replayer.play(offset);
    setPlaying(true);
  };

  const restart = () => {
    replayerRef.current?.play(0);
    setCurrentTime(0);
    setPlaying(true);
  };

  if (!hasSnapshot) {
    return (
      <div className="replay-preview__empty">
        {events.length ? `Captured ${events.length} events, but no full DOM snapshot is available.` : 'Replay data is not available yet.'}
      </div>
    );
  }

  return (
    <div className="replay-preview__native">
      <div
        ref={stageRef}
        className="replay-preview__stage"
        style={dims ? { height: Math.max(1, Math.round(dims.h * scale)) } : undefined}
      >
        <div
          className="replay-preview__scaler"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <div ref={playerRef} className="replay-preview__player" aria-hidden="true" />
        </div>
      </div>
      <div className="replay-preview__controls">
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause replay' : 'Play replay'}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={restart} aria-label="Restart replay">
          Restart
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(totalTime, 1)}
          step={1}
          value={scrubbing ?? currentTime}
          onChange={(event) => setScrubbing(Number(event.target.value))}
          onPointerUp={(event) => {
            seek(Number((event.currentTarget as HTMLInputElement).value));
            setScrubbing(null);
          }}
          aria-label="Replay position"
        />
        <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Replay speed">
          {speeds.map((option) => (
            <option key={option} value={option}>
              {option}×
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

